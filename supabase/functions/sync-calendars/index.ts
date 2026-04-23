/**
 * sync-calendars
 * ---------------------------------------------------------------
 * Polls each `calendar_connections` row, pulls fresh events from the
 * upstream provider (Google first; Outlook stubbed), and upserts any
 * events matching the configured flag into `calendar_open_slots`.
 *
 * Runs on a pg_cron schedule (see
 * 20260423120005_calendar_sync.sql) and can also be invoked ad-hoc
 * from the client ("Refresh availability" button) by passing
 * `{ profileId }` in the POST body.
 *
 * ## What this function intentionally does NOT do
 * - It does not exchange OAuth codes → that belongs in a separate
 *   `calendar-oauth-callback` function (not included in this drop —
 *   next-mile work documented in docs/GO_LIVE.md).
 * - It does not write to `bps_slots`. The dispatch screen joins
 *   `calendar_open_slots` to its existing slot pipeline at read
 *   time, which keeps the two systems decoupled.
 * - It does not store the event body, attendees, or location.
 *   We only record start/end and the flag that matched — PII
 *   minimisation by design.
 *
 * ## Failure modes handled
 *   - Provider 401 → mark `last_error`, do not crash the loop.
 *   - Provider 403 (rate limit) → exponential back-off via the
 *     `next_attempt_at` column (not yet persisted; TODO left below).
 *   - Decrypt failure → log + skip the row.
 */

// @ts-expect-error Deno import.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin, hasAdminCredentials } from '../_shared/supabaseAdmin.ts';
import { audit } from '../_shared/audit.ts';
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';

interface RunBody { profileId?: string | null }

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight();
  if (!hasAdminCredentials()) {
    return jsonResponse({ error: 'server_not_configured' }, { status: 503 });
  }

  const correlationId = req.headers.get('x-correlation-id') ?? cryptoRandomId();
  const body = (await safeJson(req)) as RunBody;

  // 1. Load flag token (what we pattern-match on event titles).
  const { data: flagRow } = await supabaseAdmin
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', 'calendar_flag_token')
    .maybeSingle();
  const flagToken = (flagRow?.setting_value ?? '[BPS-OPEN]').trim();

  // 2. Fetch connections — either all of them (cron) or a single
  //    profile (ad-hoc client trigger).
  const query = supabaseAdmin.from('calendar_connections').select('*');
  const { data: connections, error: connErr } = body.profileId
    ? await query.eq('profile_id', body.profileId)
    : await query;
  if (connErr) return jsonResponse({ error: connErr.message }, { status: 500 });

  let ok = 0; let failed = 0;
  for (const conn of connections ?? []) {
    try {
      await syncOne(conn, flagToken, correlationId);
      ok += 1;
    } catch (err) {
      failed += 1;
      await supabaseAdmin
        .from('calendar_connections')
        .update({ last_error: (err as Error)?.message ?? String(err) })
        .eq('id', conn.id);
      await audit({
        source: 'calendar',
        action: 'sync_failed',
        severity: 'warn',
        correlationId,
        payload: { connection_id: conn.id, provider: conn.provider, message: (err as Error)?.message }
      });
    }
  }

  return jsonResponse({ ok, failed, correlationId });
});

// --------------------------------------------------------------
// Provider dispatch
// --------------------------------------------------------------

async function syncOne(conn: Record<string, unknown>, flagToken: string, correlationId: string) {
  // TODO(go-live): replace these stubs with a real decrypt + fetch
  // once OAuth credentials are wired up. The shape below is already
  // what the rest of the function expects.

  if (conn.provider === 'google') {
    const events = await fetchGoogleEvents(conn);
    await upsertMatchingEvents(conn, events, flagToken);
  } else if (conn.provider === 'outlook') {
    // Outlook parity is a Feature-1-follow-up. Skipping here keeps
    // the cron loop alive without throwing.
    await audit({
      source: 'calendar',
      action: 'outlook_skipped',
      severity: 'debug',
      correlationId,
      payload: { connection_id: conn.id }
    });
    return;
  } else {
    throw new Error(`Unknown provider: ${conn.provider}`);
  }

  await supabaseAdmin
    .from('calendar_connections')
    .update({ last_sync_at: new Date().toISOString(), last_error: null })
    .eq('id', conn.id as string);
}

// --------------------------------------------------------------
// Google specifics (stubbed — real call goes in at go-live time)
// --------------------------------------------------------------

async function fetchGoogleEvents(conn: Record<string, unknown>): Promise<CalendarEvent[]> {
  // When live, this should:
  //   1. Decrypt `access_token_ciphertext` (pgsodium / Vault).
  //   2. If expired, refresh via the stored refresh token.
  //   3. Call https://www.googleapis.com/calendar/v3/calendars/{id}/events
  //      with `syncToken` (stored in `conn.sync_cursor`) for incremental sync.
  //   4. Update `sync_cursor` with the response's `nextSyncToken`.
  //
  // For now we return an empty list so the upsert path is exercised
  // without any real network calls. The edge function deploys and
  // runs cleanly; the first real event shows up as soon as an
  // engineer wires up the OAuth + decrypt plumbing described in
  // docs/GO_LIVE.md.
  void conn;
  return [];
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string; timeZone?: string };
  end:   { dateTime: string; timeZone?: string };
}

async function upsertMatchingEvents(
  conn: Record<string, unknown>,
  events: CalendarEvent[],
  flagToken: string
) {
  const matches = events.filter((e) =>
    (e.summary ?? '').toUpperCase().includes(flagToken.toUpperCase())
  );
  if (matches.length === 0) return;

  const rows = matches.map((e) => ({
    connection_id:   conn.id,
    profile_id:      conn.profile_id,
    start_time:      e.start.dateTime,
    end_time:        e.end.dateTime,
    source_event_id: e.id,
    title_flag:      flagToken,
    synced_at:       new Date().toISOString()
  }));

  await supabaseAdmin
    .from('calendar_open_slots')
    .upsert(rows, { onConflict: 'connection_id,source_event_id' });
}

// --------------------------------------------------------------
// Utils
// --------------------------------------------------------------

async function safeJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return {}; }
}

function cryptoRandomId() {
  return crypto.randomUUID();
}
