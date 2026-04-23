/**
 * Integration Adapter Factory
 * ---------------------------------------------------------------
 * Single entry-point for the UI to grab a calendar / zoom / okta
 * client. The factory looks at the current environment mode
 * (`VITE_<NAME>_MODE = mock | live`) and returns either the mock
 * adapter or the real one.
 *
 * This indirection means:
 *   - The UI imports `getCalendarAdapter()` once and never cares
 *     about credentials.
 *   - Swapping `mock` → `live` is a one-line env change for the
 *     engineer finishing the integration.
 *   - Tests can force `mock` via `VITE_*_MODE=mock` or by stubbing
 *     this module.
 *
 * The adapter *shapes* (method signatures) are documented in each
 * adapter module. Anything consuming the factory should program
 * against those contracts only.
 */

import { calendarMockAdapter }  from '../calendar/mockAdapter';
import { calendarLiveAdapter }  from '../calendar/googleAdapter';
import { zoomMockAdapter }      from '../zoom/mockAdapter';
import { zoomLiveAdapter }      from '../zoom/liveAdapter';
import { oktaMockAdapter }      from '../auth/oktaMockAdapter';
import { oktaLiveAdapter }      from '../auth/oktaAdapter';

const MODES = Object.freeze({ MOCK: 'mock', LIVE: 'live' });

/**
 * Returns the configured mode for a given integration. Defaults to
 * 'mock' so the app is always safe out of the box.
 *
 * @param {'CALENDAR'|'ZOOM'|'OKTA'} key
 * @returns {'mock'|'live'}
 */
export function getIntegrationMode(key) {
  const envKey = `VITE_${key}_MODE`;
  const raw = typeof import.meta !== 'undefined' ? import.meta.env?.[envKey] : undefined;
  return raw === MODES.LIVE ? MODES.LIVE : MODES.MOCK;
}

export function getCalendarAdapter() {
  return getIntegrationMode('CALENDAR') === MODES.LIVE
    ? calendarLiveAdapter
    : calendarMockAdapter;
}

export function getZoomAdapter() {
  return getIntegrationMode('ZOOM') === MODES.LIVE
    ? zoomLiveAdapter
    : zoomMockAdapter;
}

export function getOktaAdapter() {
  return getIntegrationMode('OKTA') === MODES.LIVE
    ? oktaLiveAdapter
    : oktaMockAdapter;
}
