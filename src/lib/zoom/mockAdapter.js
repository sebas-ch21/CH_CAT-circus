/**
 * Zoom (mock) adapter
 * ---------------------------------------------------------------
 * Deterministic stand-in used whenever `VITE_ZOOM_MODE` is not
 * `live`. Returns a plausibly-shaped join URL so end-to-end flows in
 * `ZoomLinkModal` / `DispatchActionPanel` behave naturally during
 * development and demos.
 */

export const zoomMockAdapter = {
  isConfigured() {
    return true;
  },

  async generateMeetingLink({ slot }) {
    if (!slot?.id) throw new Error('slot.id is required (mock).');
    // Mimic Zoom's 11-digit numeric meeting id for realism.
    const meetingId = String(Math.floor(1e10 + Math.random() * 9e10));
    return {
      joinUrl:   `https://zoom.us/j/${meetingId}?pwd=mock`,
      meetingId,
      hostId:    'mock-host',
      source:    'user'
    };
  }
};
