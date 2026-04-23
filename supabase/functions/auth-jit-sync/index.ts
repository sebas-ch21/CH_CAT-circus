/**
 * auth-jit-sync
 * ---------------------------------------------------------------
 * Just-In-Time provisioning for Okta OIDC logins. Invoked from the
 * client AuthContext the first time a user lands on the app with an
 * SSO session but no matching `profiles` row.
 *
 * ## Responsibilities
 *   1. Validate the caller's Supabase Auth session (Supabase injects
 *      an `Authorization: Bearer <jwt>` header into Edge Function
 *      invocations — we verify it with the service-role client).
 *   2. Pull the user's `groups` claim and look up the configured
 *      group → role mapping.
 *   3. Upsert a `profiles` row (leaving tier_rank + hierarchy empty
 *      for an admin to fill in afterwards).
 *   4. Write a structured audit row into `auth_audit_log`.
 *
 * ## Contract
 *   POST { email?: string }
 *   →    { profileExists: boolean, created: boolean, role: string | null }
 *
 * ## Intentional non-goals
 *   - Tier assignment: we don't infer tier_rank from groups. Admins
 *     still own that decision via the Admin Panel.
 *   - Hierarchy: manager_id / admin_id is left NULL; the Admin Panel
 *     has its own UX for that.
 */

// @ts-expect-error Deno import.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin, hasAdminCredentials } from '../_shared/supabaseAdmin.ts';
import { audit } from '../_shared/audit.ts';
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';

interface Body {
  email?: string;
}

interface GroupRoleMap {
  [group: string]: 'ADMIN' | 'MANAGER' | 'IC';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight();

  if (!hasAdminCredentials()) {
    return jsonResponse({ error: 'server_not_configured' }, { status: 503 });
  }

  try {
    // ----------------------------------------------------------------
    // 1. Authenticate the caller's Supabase session.
    // ----------------------------------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return jsonResponse({ error: 'missing_jwt' }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'invalid_jwt' }, { status: 401 });
    }
    const authUser = userData.user;

    const body = (await safeJson(req)) as Body;
    const email = (body.email ?? authUser.email ?? '').toLowerCase();
    if (!email) return jsonResponse({ error: 'missing_email' }, { status: 400 });
    if (authUser.email?.toLowerCase() !== email) {
      // Defence-in-depth: never let a caller provision a different
      // identity than their own JWT.
      return jsonResponse({ error: 'email_mismatch' }, { status: 403 });
    }

    // ----------------------------------------------------------------
    // 2. Look up the group → role map from app_settings.
    // ----------------------------------------------------------------
    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'okta_group_role_map')
      .maybeSingle();

    let map: GroupRoleMap = {};
    if (settingsRow?.setting_value) {
      try { map = JSON.parse(settingsRow.setting_value); } catch { /* keep empty */ }
    }

    // Supabase mirrors OIDC claims under `user_metadata` and/or
    // `raw_user_meta_data`. Okta delivers groups under `groups`.
    const rawGroups =
      (authUser.user_metadata?.groups as string[] | undefined) ??
      (authUser.app_metadata?.groups as string[] | undefined) ??
      [];
    const resolvedRole = resolveRole(rawGroups, map);

    // ----------------------------------------------------------------
    // 3. Upsert profile.
    // ----------------------------------------------------------------
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();

    let created = false;
    if (!existing && resolvedRole) {
      const { error: insertErr } = await supabaseAdmin.from('profiles').insert({
        email,
        role: resolvedRole
      });
      if (insertErr) {
        await audit({
          source: 'auth',
          action: 'jit_insert_failed',
          severity: 'error',
          payload: { email, message: insertErr.message }
        });
        return jsonResponse({ error: 'insert_failed' }, { status: 500 });
      }
      created = true;
    } else if (existing && resolvedRole && existing.role !== resolvedRole) {
      // Okta group changed server-side → reflect locally.
      await supabaseAdmin
        .from('profiles')
        .update({ role: resolvedRole, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }

    // ----------------------------------------------------------------
    // 4. Write the audit log row.
    // ----------------------------------------------------------------
    await supabaseAdmin.from('auth_audit_log').insert({
      email,
      resolved_role: resolvedRole,
      okta_groups: rawGroups,
      event: created ? 'jit_create' : existing ? 'login' : 'role_mismatch',
      claims: sanitiseClaims(authUser.user_metadata ?? {})
    });

    const profileExists = Boolean(existing || created);
    return jsonResponse({ profileExists, created, role: resolvedRole });
  } catch (err) {
    await audit({
      source: 'auth',
      action: 'jit_uncaught',
      severity: 'error',
      payload: { message: (err as Error)?.message ?? String(err) }
    });
    return jsonResponse({ error: 'internal' }, { status: 500 });
  }
});

function resolveRole(groups: string[], map: GroupRoleMap) {
  // First match wins; higher-privilege groups should come first in
  // the JSON config, but we defensively prefer ADMIN > MANAGER > IC
  // when multiple groups match.
  const order: Array<'ADMIN' | 'MANAGER' | 'IC'> = ['ADMIN', 'MANAGER', 'IC'];
  for (const role of order) {
    for (const [g, r] of Object.entries(map)) {
      if (r === role && groups.includes(g)) return role;
    }
  }
  return null;
}

function sanitiseClaims(claims: Record<string, unknown>) {
  // Drop anything that looks like a raw token so the audit log does
  // not become a secret store.
  const clone = { ...claims } as Record<string, unknown>;
  for (const key of Object.keys(clone)) {
    if (/token|secret|password/i.test(key)) delete clone[key];
  }
  return clone;
}

async function safeJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return {}; }
}
