/**
 * Zoom (live) adapter
 * ---------------------------------------------------------------
 * Invoked when `VITE_ZOOM_MODE=live`. Acts as a thin fetch shim in
 * front of the `zoom-create-meeting` Edge Function. All Zoom OAuth
 * credentials + quota bookkeeping happen server-side; the client
 * only forwards the slot context.
 *
 * ## Contract (shared with zoomMockAdapter)
 *   - generateMeetingLink({ slot })
 *       → Promise<{ joinUrl, meetingId, hostId, source }>
 *   - isConfigured() → boolean
 *
 * ## Why the client-side code is intentionally minimal
 * Zoom's Server-to-Server OAuth flow requires a client secret we
 * must never expose to the browser. Keeping this adapter as a pure
 * function wrapper also simplifies testing — stubbing is one line.
 */

import { supabase } from '../supabase';

export const zoomLiveAdapter = {
  isConfigured() {
    // The client has no way to prove server-side creds exist. We
    // optimistically return true and let the edge function reject
    // calls with a structured error when it is misconfigured — the
    // UI surfaces that error to the user.
    return true;
  },

  /**
   * @param {object}   opts
   * @param {object}   opts.slot                    bps_slot row
   * @param {string}  [opts.clientRequestId]        Optional idempotency id
   * @returns {Promise<{ joinUrl: string, meetingId: string, hostId: string, source: 'user'|'room' }>}
   */
  async generateMeetingLink({ slot, clientRequestId }) {
    if (!slot?.id) throw new Error('slot.id is required to generate a Zoom meeting link.');

    const { data, error } = await supabase.functions.invoke('zoom-create-meeting', {
      body: {
        slot_id: slot.id,
        client_request_id: clientRequestId ?? crypto.randomUUID()
      }
    });
    if (error) throw error;
    if (!data?.joinUrl) throw new Error('Zoom meeting creation returned no join URL.');
    return data;
  }
};
