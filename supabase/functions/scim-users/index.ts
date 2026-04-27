/**
 * scim-users
 * ---------------------------------------------------------------
 * Minimal SCIM 2.0 `/Users` endpoint consumed by Okta's provisioning
 * connector. Deliberately small: we only implement the operations
 * that Okta will actually send for standard lifecycle use-cases.
 *
 *   GET    /Users                  — list (used by Okta to reconcile)
 *   GET    /Users/{externalId}     — fetch one
 *   POST   /Users                  — create
 *   PATCH  /Users/{externalId}     — partial update (incl. deactivation)
 *   DELETE /Users/{externalId}     — hard delete (soft-delete preferred)
 *
 * ## Authentication
 * Okta sends a static `Authorization: Bearer <shared secret>` header
 * on every request. The shared secret lives in the `OKTA_SCIM_BEARER_TOKEN`
 * Supabase secret.
 *
 * ## Data mapping
 *   SCIM                    → app
 *   userName                → profiles.email
 *   externalId              → scim_subjects.external_id
 *   active (boolean)        → scim_subjects.active + profile status
 *   urn:.../groups[*].value → role resolution (same path as JIT sync)
 *
 * ## Intentional omissions
 *   - We do NOT accept arbitrary `displayName` / `name.givenName` etc.
 *     because the `profiles` table does not model them yet. Add columns
 *     later and extend `toScim()`/`applyPatch()` in lockstep.
 *   - We do NOT implement filter expressions beyond the trivial
 *     `userName eq "..."` that Okta uses for deduplication.
 */

// @ts-expect-error Deno.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin, hasAdminCredentials } from '../_shared/supabaseAdmin.ts';
import { audit } from '../_shared/audit.ts';
import { handleCorsPreflight, corsHeaders } from '../_shared/cors.ts';

// @ts-expect-error Deno global.
const SCIM_BEARER = Deno.env.get('OKTA_SCIM_BEARER_TOKEN') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight();

  if (!hasAdminCredentials()) return scimError(503, 'server_not_configured');
  if (!verifyBearer(req))     return scimError(401, 'invalid_token');

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // `/functions/v1/scim-users/{externalId?}`
  const externalId = pathParts[pathParts.length - 1] !== 'scim-users'
    ? decodeURIComponent(pathParts[pathParts.length - 1])
    : null;

  try {
    switch (req.method) {
      case 'GET':    return externalId ? await handleGetOne(externalId) : await handleList(url);
      case 'POST':   return await handleCreate(req);
      case 'PATCH':  return externalId ? await handlePatch(externalId, req) : scimError(400, 'missing_id');
      case 'DELETE': return externalId ? await handleDelete(externalId) : scimError(400, 'missing_id');
      default:       return scimError(405, 'method_not_allowed');
    }
  } catch (err) {
    await audit({
      source: 'scim',
      action: 'uncaught',
      severity: 'error',
      payload: { path: url.pathname, message: (err as Error)?.message ?? String(err) }
    });
    return scimError(500, 'internal');
  }
});

// --------------------------------------------------------------
// Handlers
// --------------------------------------------------------------

async function handleList(url: URL): Promise<Response> {
  // Trivial filter support: `filter=userName eq "foo@bar"`.
  const filter = url.searchParams.get('filter') ?? '';
  const match = /userName\s+eq\s+"([^"]+)"/i.exec(filter);

  const query = supabaseAdmin
    .from('scim_subjects')
    .select('external_id, active, profile:profiles!inner(id, email, role)')
    .limit(parseInt(url.searchParams.get('count') ?? '100', 10));

  const { data, error } = match
    ? await query.eq('profile.email', match[1].toLowerCase())
    : await query;

  if (error) return scimError(500, error.message);

  return scimResponse({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: data?.length ?? 0,
    Resources: (data ?? []).map(toScim),
    startIndex: 1,
    itemsPerPage: data?.length ?? 0
  });
}

async function handleGetOne(externalId: string): Promise<Response> {
  const { data, error } = await supabaseAdmin
    .from('scim_subjects')
    .select('external_id, active, profile:profiles!inner(id, email, role)')
    .eq('external_id', externalId)
    .maybeSingle();

  if (error) return scimError(500, error.message);
  if (!data)  return scimError(404, 'not_found');
  return scimResponse(toScim(data));
}

async function handleCreate(req: Request): Promise<Response> {
  const body = (await safeJson(req)) as Record<string, unknown>;
  const externalId = String(body.externalId ?? '').trim();
  const userName = String(body.userName ?? '').trim().toLowerCase();
  if (!externalId || !userName) return scimError(400, 'missing_fields');

  // 1. Upsert the profile (email unique).
  const { data: profileRow, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .upsert({ email: userName }, { onConflict: 'email' })
    .select('id')
    .maybeSingle();
  if (profileErr || !profileRow) return scimError(500, profileErr?.message ?? 'upsert_failed');

  // 2. Bind SCIM subject.
  const { error: subjErr } = await supabaseAdmin
    .from('scim_subjects')
    .upsert({
      external_id: externalId,
      profile_id: profileRow.id,
      active: body.active !== false,
      last_sync_at: new Date().toISOString()
    }, { onConflict: 'external_id' });
  if (subjErr) return scimError(500, subjErr.message);

  await audit({
    source: 'scim',
    action: 'create',
    severity: 'info',
    actorProfileId: profileRow.id,
    payload: { externalId, userName }
  });

  return scimResponse({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: externalId,
    externalId,
    userName,
    active: body.active !== false
  }, 201);
}

async function handlePatch(externalId: string, req: Request): Promise<Response> {
  const body = (await safeJson(req)) as Record<string, unknown>;
  const ops = Array.isArray(body.Operations) ? (body.Operations as Array<Record<string, unknown>>) : [];

  let activeOverride: boolean | null = null;
  for (const op of ops) {
    // Only support the `active` path for now — that covers
    // deactivation, the primary deprovisioning signal from Okta.
    if (String(op.op).toLowerCase() === 'replace' && op.path === 'active') {
      activeOverride = Boolean(op.value);
    } else if (String(op.op).toLowerCase() === 'replace' && !op.path && typeof op.value === 'object') {
      const v = op.value as Record<string, unknown>;
      if ('active' in v) activeOverride = Boolean(v.active);
    }
  }

  const { data: subject } = await supabaseAdmin
    .from('scim_subjects')
    .select('profile_id')
    .eq('external_id', externalId)
    .maybeSingle();
  if (!subject) return scimError(404, 'not_found');

  if (activeOverride !== null) {
    await supabaseAdmin
      .from('scim_subjects')
      .update({ active: activeOverride, last_sync_at: new Date().toISOString() })
      .eq('external_id', externalId);

    // Mirror to profile status so dispatch screens pick it up.
    await supabaseAdmin
      .from('profiles')
      .update({ current_status: activeOverride ? 'AVAILABLE' : 'BUSY' })
      .eq('id', subject.profile_id);
  }

  await audit({
    source: 'scim',
    action: 'patch',
    severity: 'info',
    actorProfileId: subject.profile_id,
    payload: { externalId, activeOverride }
  });

  return scimResponse({ ok: true });
}

async function handleDelete(externalId: string): Promise<Response> {
  const { data: subject } = await supabaseAdmin
    .from('scim_subjects')
    .select('profile_id')
    .eq('external_id', externalId)
    .maybeSingle();
  if (!subject) return scimError(404, 'not_found');

  // Soft-delete by default: flip to inactive. Many identity teams
  // rely on account history being preserved for audit. Actual row
  // deletion should be a quarterly batch job, not a hot-path SCIM call.
  await supabaseAdmin
    .from('scim_subjects')
    .update({ active: false, last_sync_at: new Date().toISOString() })
    .eq('external_id', externalId);

  await audit({
    source: 'scim',
    action: 'delete_soft',
    severity: 'info',
    actorProfileId: subject.profile_id,
    payload: { externalId }
  });

  return scimResponse({ ok: true });
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function toScim(row: { external_id: string; active: boolean; profile: { email: string; role: string } }) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: row.external_id,
    externalId: row.external_id,
    userName: row.profile.email,
    active: row.active,
    'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
      department: row.profile.role
    }
  };
}

function verifyBearer(req: Request): boolean {
  if (!SCIM_BEARER) return false;
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  // Constant-time compare to avoid timing leaks.
  if (token.length !== SCIM_BEARER.length) return false;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) mismatch |= token.charCodeAt(i) ^ SCIM_BEARER.charCodeAt(i);
  return mismatch === 0;
}

async function safeJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return {}; }
}

function scimResponse(body: unknown, status = 200): Response {
  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', 'application/scim+json');
  return new Response(JSON.stringify(body), { status, headers });
}

function scimError(status: number, detail: string): Response {
  return scimResponse({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: String(status),
    detail
  }, status);
}
