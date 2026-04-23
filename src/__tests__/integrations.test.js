/**
 * Integration adapter contract tests.
 *
 * These do not exercise the real providers — they only pin down the
 * adapter contract so a live implementation cannot accidentally
 * drift from the mock (and vice-versa). When the engineer finishes
 * an integration, the tests should keep passing without changes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { joinUrl: 'https://zoom.us/j/123' }, error: null }) },
    auth: { signInWithSSO: vi.fn().mockResolvedValue({ error: null }), signOut: vi.fn() }
  }
}));

import { zoomMockAdapter }    from '../lib/zoom/mockAdapter';
import { zoomLiveAdapter }    from '../lib/zoom/liveAdapter';
import { calendarMockAdapter } from '../lib/calendar/mockAdapter';
import { calendarLiveAdapter } from '../lib/calendar/googleAdapter';
import { oktaMockAdapter }     from '../lib/auth/oktaMockAdapter';
import { oktaLiveAdapter }     from '../lib/auth/oktaAdapter';
import {
  isFeatureEnabled,
  isFeatureEnabledAsync,
  FEATURES,
  __resetFeatureFlagsCacheForTests
} from '../lib/integrations/featureFlags';

describe('Zoom adapter contract', () => {
  it('mock + live both expose generateMeetingLink + isConfigured', () => {
    for (const a of [zoomMockAdapter, zoomLiveAdapter]) {
      expect(typeof a.generateMeetingLink).toBe('function');
      expect(typeof a.isConfigured).toBe('function');
    }
  });

  it('mock.generateMeetingLink returns a shape the UI expects', async () => {
    const r = await zoomMockAdapter.generateMeetingLink({ slot: { id: 'abc' } });
    expect(r).toHaveProperty('joinUrl');
    expect(r).toHaveProperty('meetingId');
    expect(r).toHaveProperty('hostId');
    expect(r.source).toMatch(/user|room/);
  });
});

describe('Calendar adapter contract', () => {
  it('mock + live both expose the same methods', () => {
    for (const a of [calendarMockAdapter, calendarLiveAdapter]) {
      expect(typeof a.isConfigured).toBe('function');
      expect(typeof a.connect).toBe('function');
      expect(typeof a.listOpenSlots).toBe('function');
      expect(typeof a.triggerSync).toBe('function');
    }
  });

  it('mock.listOpenSlots returns at least one slot with start/end', async () => {
    const slots = await calendarMockAdapter.listOpenSlots('p1');
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      expect(s).toHaveProperty('start_time');
      expect(s).toHaveProperty('end_time');
      expect(s).toHaveProperty('title_flag');
    }
  });
});

describe('Okta adapter contract', () => {
  it('mock + live both expose signIn + signOut + isConfigured', () => {
    for (const a of [oktaMockAdapter, oktaLiveAdapter]) {
      expect(typeof a.signIn).toBe('function');
      expect(typeof a.signOut).toBe('function');
      expect(typeof a.isConfigured).toBe('function');
    }
  });
});

describe('Feature flags', () => {
  beforeEach(() => {
    __resetFeatureFlagsCacheForTests();
  });

  it('defaults to false when the flag row is missing', async () => {
    const v = await isFeatureEnabledAsync(FEATURES.ZOOM_MEETING_API);
    expect(v).toBe(false);
  });

  it('sync check never throws', () => {
    expect(() => isFeatureEnabled(FEATURES.CALENDAR_SYNC)).not.toThrow();
  });
});
