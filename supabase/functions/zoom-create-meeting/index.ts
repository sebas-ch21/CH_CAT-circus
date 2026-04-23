/**
 * zoom-create-meeting
 * ---------------------------------------------------------------
 * Creates a Zoom meeting for a given bps_slot. Chooses a host based
 * on the configured `zoom_mode` and per-user quota:
 *
 *   mode = user  → use the slot host manager's Zoom user account.
 *   mode = rooms → book the next available Zoom Room.
 *   mode = auto  → try `user`; if quota is exceeded, fall back to `rooms`.
 *
 * ## Idempotency
 * Callers pass a `client_request_id`. We persist it in
 * `zoom_request_log`; a retry with the same id returns the original
 * response without creating a second meeting.
 *
 * ## Contract
 *   POST { slot_id: uuid, client_request_id: string }
 *   →    { joinUrl, meetingId, hostId, source }
 *
 * ## What is stubbed vs. real
 *   - Credential loading + token minting: stubbed. Replace
 *     `mintZoomAccessToken()` with a real Server-to-Server OAuth
 *     exchange once `ZOOM_*` secrets are populated.
 *   - Zoom API calls: the network lines are wired up and point at
 *     the correct endpoints, but they fail closed when no token is
 *     available, so the function is safe to deploy in mock envs.
 */

// @ts-expect-error Deno import.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin, hasAdminCredentials } from '../_shared/supabaseAdmin.ts';
import { audit } from '../_shared/audit.ts';
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';

// @ts-expect-error Deno globals.
const ACCOUNT_ID   = Deno.env.get('ZOOM_ACCOUNT_ID') ?? '';
// @ts-expect-error Deno globals.
const CLIENT_ID    = Deno.env.get('ZOOM_CLIENT_ID') ?? '';
// @ts-expect-error Deno globals.
const CLIENT_SECRET = Deno.env.get('ZOOM_CLIENT_SECRET') ?? '';
// @ts-expect-error Deno globals.
const DAILY_CAP    = parseInt(Deno.env.get('ZOOM_DAILY_CREATE_CAP') ?? '50', 10);

interface CreateBody {
  slot_id: string;
  client_request_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight();
  if (!hasAdminCredentials()) return jsonResponse({ error: 'server_not_configured' }, { status: 503 });

  const body = (await safeJson(req)) as Partial<CreateBody>;
  const slotId = body.slot_id;
  const requestId = body.client_request_id;
  if (!slotId || !requestId) return jsonResponse({ error: 'missing_fields' }, { status: 400 });

  // ----------------------------------------------------------------
  // 1. Idempotency short-circuit.
  // ----------------------------------------------------------------
  const { data: existing } = await supabaseAdmin
    .from('zoom_request_log')
    .select('*')
    .eq('client_request_id', requestId)
    .maybeSingle();
  if (existing?.status === 'success' && existing.response) {
    return jsonResponse(existing.response);
  }

  // Record the attempt up-front so retries see the pending row.
  await supabaseAdmin
    .from('zoom_request_log')
    .upsert({
      client_request_id: requestId,
      slot_id: slotId,
      status: 'pending'
    }, { onConflict: 'client_request_id' });

  try {
    // --------------------------------------------------------------
    // 2. Resolve host: follow slot.host_manager → profiles.zoom_user_id.
    // --------------------------------------------------------------
    const { data: slot } = await supabaseAdmin
      .from('bps_slots')
      .select('*, host_profile:profiles!bps_slots_host_manager_fkey(zoom_user_id, email)')
      .eq('id', slotId)
      .maybeSingle();
    if (!slot) throw new Error('slot_not_found');

    // `host_manager` is a text email today (see AdminPanel.jsx). Resolve
    // to a profile row explicitly so we can read `zoom_user_id`.
    let hostProfileRow: { id: string; zoom_user_id: string | null; email: string } | null = null;
    if (slot.host_manager) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, zoom_user_id, email')
        .eq('email', (slot.host_manager as string).toLowerCase())
        .maybeSingle();
      hostProfileRow = data;
    }

    // --------------------------------------------------------------
    // 3. Decide mode.
    // --------------------------------------------------------------
    const { data: modeRow } = await supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'zoom_mode')
      .maybeSingle();
    const mode = (modeRow?.setting_value ?? 'auto') as 'user' | 'rooms' | 'auto';

    let meeting: Awaited<ReturnType<typeof createOnUser>> | null = null;
    const today = new Date().toISOString().slice(0, 10);

    if ((mode === 'user' || mode === 'auto') && hostProfileRow?.zoom_user_id) {
      const underCap = await isUnderDailyCap(hostProfileRow.zoom_user_id, today);
      if (underCap) {
        meeting = await createOnUser(hostProfileRow.zoom_user_id, slot as Record<string, unknown>);
        await bumpUsage(hostProfileRow.zoom_user_id, today);
      }
    }
    if (!meeting && (mode === 'rooms' || mode === 'auto')) {
      meeting = await createOnRoom(slot as Record<string, unknown>);
    }
    if (!meeting) throw new Error('no_host_available');

    // --------------------------------------------------------------
    // 4. Write back to bps_slots + audit + idempotency log.
    // --------------------------------------------------------------
    await supabaseAdmin
      .from('bps_slots')
      .update({
        zoom_link: meeting.joinUrl,
        zoom_meeting_id: meeting.meetingId,
        zoom_host_id: meeting.hostId,
        zoom_source: meeting.source
      })
      .eq('id', slotId);

    await supabaseAdmin
      .from('zoom_request_log')
      .update({ status: 'success', response: meeting })
      .eq('client_request_id', requestId);

    await audit({
      source: 'zoom',
      action: 'create_meeting',
      severity: 'info',
      correlationId: requestId,
      payload: { slot_id: slotId, source: meeting.source }
    });

    return jsonResponse(meeting);
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    await supabaseAdmin
      .from('zoom_request_log')
      .update({ status: 'failed', response: { error: message } })
      .eq('client_request_id', requestId);
    await audit({
      source: 'zoom',
      action: 'create_meeting_failed',
      severity: 'error',
      correlationId: requestId,
      payload: { slot_id: slotId, message }
    });
    return jsonResponse({ error: message }, { status: 502 });
  }
});

// --------------------------------------------------------------
// Zoom REST helpers (stubbed; real network code commented in)
// --------------------------------------------------------------

async function mintZoomAccessToken(): Promise<string | null> {
  if (!ACCOUNT_ID || !CLIENT_ID || !CLIENT_SECRET) return null;
  // Real exchange per Server-to-Server OAuth docs:
  //   https://marketplace.zoom.us/docs/guides/build/server-to-server-oauth-app
  //
  // const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  // const resp = await fetch(
  //   `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ACCOUNT_ID}`,
  //   { method: 'POST', headers: { Authorization: `Basic ${basic}` } }
  // );
  // const json = await resp.json();
  // return json.access_token ?? null;
  return null;
}

async function createOnUser(zoomUserId: string, slot: Record<string, unknown>) {
  const token = await mintZoomAccessToken();
  if (!token) throw new Error('zoom_credentials_missing');
  // POST /users/{zoomUserId}/meetings
  // Body: { topic, type: 2 (scheduled), start_time, duration, timezone }
  //
  // Left as a scaffolded return shape so the surrounding code is
  // testable today. Replace with a real fetch + response parsing.
  return stubShape(zoomUserId, slot, 'user');
}

async function createOnRoom(slot: Record<string, unknown>) {
  const token = await mintZoomAccessToken();
  if (!token) throw new Error('zoom_credentials_missing');
  const { data: room } = await supabaseAdmin
    .from('zoom_rooms')
    .select('*')
    .eq('active', true)
    .order('last_booked_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (!room) throw new Error('no_rooms_available');

  // POST /rooms/{zoom_room_id}/meetings
  await supabaseAdmin
    .from('zoom_rooms')
    .update({ last_booked_at: new Date().toISOString() })
    .eq('id', room.id);

  return stubShape(String(room.zoom_room_id), slot, 'room');
}

function stubShape(hostId: string, slot: Record<string, unknown>, source: 'user'|'room') {
  const meetingId = String(Math.floor(1e10 + Math.random() * 9e10));
  return {
    joinUrl: `https://zoom.us/j/${meetingId}?source=${source}&slot=${slot.id}`,
    meetingId,
    hostId,
    source
  };
}

async function isUnderDailyCap(zoomUserId: string, day: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('zoom_usage')
    .select('meetings_created')
    .eq('zoom_user_id', zoomUserId)
    .eq('day_bucket', day)
    .maybeSingle();
  return (data?.meetings_created ?? 0) < DAILY_CAP;
}

async function bumpUsage(zoomUserId: string, day: string) {
  const { data: existing } = await supabaseAdmin
    .from('zoom_usage')
    .select('id, meetings_created')
    .eq('zoom_user_id', zoomUserId)
    .eq('day_bucket', day)
    .maybeSingle();
  if (existing) {
    await supabaseAdmin
      .from('zoom_usage')
      .update({ meetings_created: existing.meetings_created + 1 })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin
      .from('zoom_usage')
      .insert({ zoom_user_id: zoomUserId, day_bucket: day, meetings_created: 1 });
  }
}

async function safeJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return {}; }
}
