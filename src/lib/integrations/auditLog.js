/**
 * Integration Audit Log
 * ---------------------------------------------------------------
 * Thin wrapper around `integration_audit_log` so UI + adapter code
 * can record structured events without duplicating SQL. All three
 * integrations share a single log table (see
 * 20260423120003_integration_scaffolding.sql) keyed on a `source`
 * discriminator.
 *
 * ## Usage
 *   import { recordAudit } from '../integrations/auditLog';
 *   await recordAudit({
 *     source: 'zoom',
 *     action: 'create_meeting',
 *     correlationId: 'req_abc123',
 *     payload: { slot_id, host_manager }
 *   });
 *
 * ## Intentional design choices
 * - Never throws. Observability must not break the calling flow.
 * - Payload is clipped at ~64KB to avoid blowing up the row; logs
 *   that big indicate a misuse anyway.
 * - `actor_profile` is optional and can be either a profile id or an
 *   email — the helper resolves emails for you.
 */

import { supabase } from '../supabase';

const PAYLOAD_MAX_BYTES = 64 * 1024;

/**
 * @param {object}  entry
 * @param {'calendar'|'zoom'|'okta'|'scim'|'auth'|'other'} entry.source
 * @param {string}  entry.action
 * @param {string} [entry.correlationId]
 * @param {string} [entry.severity='info']  One of debug|info|warn|error
 * @param {string} [entry.actorEmail]       Email of the actor, resolved to profile id
 * @param {string} [entry.actorProfileId]   Direct profile id (takes precedence if set)
 * @param {object} [entry.payload]          Structured blob (JSON-serialisable)
 */
export async function recordAudit(entry) {
  try {
    const payload = safeJson(entry.payload ?? {});

    let actorProfile = entry.actorProfileId ?? null;
    if (!actorProfile && entry.actorEmail) {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', entry.actorEmail.toLowerCase())
        .maybeSingle();
      actorProfile = data?.id ?? null;
    }

    await supabase.from('integration_audit_log').insert({
      source:         entry.source,
      action:         entry.action,
      severity:       entry.severity ?? 'info',
      correlation_id: entry.correlationId ?? null,
      actor_profile:  actorProfile,
      payload
    });
  } catch {
    // Deliberate swallow — observability never breaks callers.
  }
}

function safeJson(obj) {
  try {
    const json = JSON.stringify(obj);
    if (json.length > PAYLOAD_MAX_BYTES) {
      return { truncated: true, preview: json.slice(0, 2048) };
    }
    return obj;
  } catch {
    return { unserializable: true };
  }
}
