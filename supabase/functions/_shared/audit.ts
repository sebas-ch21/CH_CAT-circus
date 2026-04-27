/**
 * Audit helper for Edge Functions.
 *
 * Mirrors the client-side `recordAudit` (see src/lib/integrations/auditLog.js)
 * but writes through the service-role client so RLS does not block us
 * even if policies tighten in the future.
 */

import { supabaseAdmin, hasAdminCredentials } from './supabaseAdmin.ts';

type Severity = 'debug' | 'info' | 'warn' | 'error';
type Source = 'calendar' | 'zoom' | 'okta' | 'scim' | 'auth' | 'other';

export interface AuditEntry {
  source: Source;
  action: string;
  severity?: Severity;
  correlationId?: string;
  actorProfileId?: string | null;
  payload?: Record<string, unknown>;
}

const PAYLOAD_MAX_BYTES = 64 * 1024;

export async function audit(entry: AuditEntry): Promise<void> {
  if (!hasAdminCredentials()) return;
  try {
    await supabaseAdmin.from('integration_audit_log').insert({
      source:         entry.source,
      action:         entry.action,
      severity:       entry.severity ?? 'info',
      correlation_id: entry.correlationId ?? null,
      actor_profile:  entry.actorProfileId ?? null,
      payload:        clip(entry.payload ?? {})
    });
  } catch (err) {
    // Never throw from audit writes.
    console.warn('[audit] failed to persist entry', err);
  }
}

function clip(payload: Record<string, unknown>): Record<string, unknown> {
  try {
    const str = JSON.stringify(payload);
    if (str.length > PAYLOAD_MAX_BYTES) {
      return { truncated: true, preview: str.slice(0, 2048) };
    }
    return payload;
  } catch {
    return { unserializable: true };
  }
}
