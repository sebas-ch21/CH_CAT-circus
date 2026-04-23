/**
 * Calendar (Google, live) adapter
 * ---------------------------------------------------------------
 * Real Google Calendar client used when `VITE_CALENDAR_MODE=live`.
 *
 * ## Adapter contract
 *   - `connect(profileId)`           → Promise<void>   (starts OAuth)
 *   - `listOpenSlots(profileId)`     → Promise<Slot[]>
 *   - `triggerSync(profileId?)`      → Promise<void>   (calls edge fn)
 *   - `isConfigured()`               → boolean
 *
 * The heavy lifting lives in the `sync-calendars` Edge Function — the
 * client-side adapter is mostly a stable facade so components import
 * the same names regardless of provider.
 *
 * ## Why this file is short
 * We intentionally centralise all Google API calls server-side to
 * avoid shipping OAuth client secrets to the browser. The client
 * only ever:
 *   1. Opens the consent URL (constructed from the public client id)
 *   2. Queries `calendar_open_slots` for pre-computed open windows
 *   3. Invokes the edge function to force an out-of-band refresh
 */

import { supabase } from '../supabase';

const clientId = import.meta.env?.VITE_GOOGLE_OAUTH_CLIENT_ID ?? '';

export const calendarLiveAdapter = {
  isConfigured() {
    return Boolean(clientId);
  },

  /**
   * Launches the Google OAuth consent screen in the current window.
   * The `code` → token exchange happens on the edge function side
   * (see `calendar-oauth-callback`).
   */
  async connect() {
    if (!clientId) throw new Error('VITE_GOOGLE_OAUTH_CLIENT_ID is not set.');
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = 'https://www.googleapis.com/auth/calendar.readonly';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  async listOpenSlots(profileId) {
    const { data } = await supabase
      .from('calendar_open_slots')
      .select('*')
      .eq('profile_id', profileId)
      .gte('start_time', new Date().toISOString())
      .order('start_time');
    return data ?? [];
  },

  async triggerSync(profileId) {
    const { error } = await supabase.functions.invoke('sync-calendars', {
      body: { profileId: profileId ?? null }
    });
    if (error) throw error;
  }
};
