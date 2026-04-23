/**
 * Calendar (mock) adapter
 * ---------------------------------------------------------------
 * Deterministic stand-in for `calendarLiveAdapter` used when the
 * environment runs in `mock` mode (the default). Returns a handful
 * of fake "open" slots anchored to "now" so UI screens can be
 * verified without any Google config.
 */

export const calendarMockAdapter = {
  isConfigured() {
    return true;
  },

  async connect() {
    console.info('[calendar-mock] connect() — pretending OAuth succeeded.');
  },

  async listOpenSlots(profileId) {
    const now = new Date();
    // Generate three slots 30 minutes apart, starting 30 minutes from now.
    return Array.from({ length: 3 }).map((_, i) => {
      const start = new Date(now.getTime() + (i + 1) * 30 * 60_000);
      const end = new Date(start.getTime() + 30 * 60_000);
      return {
        id: `mock-${profileId ?? 'unknown'}-${i}`,
        profile_id: profileId,
        start_time: start.toISOString(),
        end_time:   end.toISOString(),
        source_event_id: `mock-event-${i}`,
        title_flag: '[BPS-OPEN]',
        synced_at:  now.toISOString()
      };
    });
  },

  async triggerSync() {
    console.info('[calendar-mock] triggerSync() — no-op.');
  }
};
