/**
 * Feature Flags
 * ---------------------------------------------------------------
 * Runtime on/off switches for optional integrations (Calendar, Zoom,
 * Okta). The source of truth is the `features` row in `app_settings`
 * which an admin can toggle from the Admin Panel at runtime. During
 * local development you can additionally override any flag via
 * Vite env vars — useful for CI and Storybook-style setups where
 * nobody is talking to Supabase.
 *
 * ## Precedence (highest first)
 *   1. `VITE_FORCE_FEATURE_<NAME>` env var ("true"/"false")
 *   2. `app_settings.features` JSON value from Supabase
 *   3. Safe default (`false` — never render integration UI by accident)
 *
 * ## Design notes
 * - Cached in-module for the lifetime of the SPA session to avoid a
 *   fetch on every render. Admins changing flags is rare; they can
 *   hard-reload to pick up the new value.
 * - Consumers should call `isFeatureEnabled(name)` for a simple
 *   boolean, or use the `useFeatureFlag` React hook below.
 * - Flag names are kept in a frozen object (`FEATURES`) so typos blow
 *   up at import time instead of silently returning `false`.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export const FEATURES = Object.freeze({
  CALENDAR_SYNC:    'calendar_sync',
  ZOOM_MEETING_API: 'zoom_meeting_api',
  OKTA_SSO:         'okta_sso',
  OKTA_SCIM:        'okta_scim'
});

// In-memory cache. Populated on the first fetch.
let cachedFlags = null;
let inFlight = null;

/**
 * Pull the feature flag row from Supabase and parse it. Tolerates
 * missing rows and malformed JSON by returning an empty object.
 * @returns {Promise<Record<string, boolean>>}
 */
async function loadFlags() {
  if (cachedFlags) return cachedFlags;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'features')
        .maybeSingle();
      if (!data?.setting_value) {
        cachedFlags = {};
      } else {
        try {
          cachedFlags = JSON.parse(data.setting_value);
        } catch {
          // Tolerate legacy/plaintext values; treat as all-off.
          cachedFlags = {};
        }
      }
    } catch {
      cachedFlags = {};
    } finally {
      inFlight = null;
    }
    return cachedFlags;
  })();

  return inFlight;
}

/**
 * Synchronous flag check. Pulls from cache; if the cache is cold this
 * returns `false` and schedules a warm-up so the next call is correct.
 * Meant for places where a false-y default is safe (hiding a button).
 *
 * For places that MUST wait for the real value (e.g. in a route
 * guard), use `isFeatureEnabledAsync` instead.
 *
 * @param {string} name  One of FEATURES.*
 * @returns {boolean}
 */
export function isFeatureEnabled(name) {
  const envOverride = readEnvOverride(name);
  if (envOverride !== null) return envOverride;
  if (!cachedFlags) {
    void loadFlags();
    return false;
  }
  return Boolean(cachedFlags[name]);
}

/**
 * Async variant — awaits the Supabase fetch if the cache is cold.
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function isFeatureEnabledAsync(name) {
  const envOverride = readEnvOverride(name);
  if (envOverride !== null) return envOverride;
  const flags = await loadFlags();
  return Boolean(flags[name]);
}

/**
 * React hook. Triggers a re-render once the flag resolves so UI
 * components can render their proper state without manual `useEffect`
 * boilerplate.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function useFeatureFlag(name) {
  const [enabled, setEnabled] = useState(() => {
    const envOverride = readEnvOverride(name);
    if (envOverride !== null) return envOverride;
    return cachedFlags ? Boolean(cachedFlags[name]) : false;
  });

  useEffect(() => {
    let cancelled = false;
    isFeatureEnabledAsync(name).then((v) => {
      if (!cancelled) setEnabled(v);
    });
    return () => { cancelled = true; };
  }, [name]);

  return enabled;
}

/**
 * Reset the cache. Only used by tests; production code should reload
 * the tab if they really need to observe a flag change live.
 */
export function __resetFeatureFlagsCacheForTests() {
  cachedFlags = null;
  inFlight = null;
}

function readEnvOverride(name) {
  // Vite inlines `import.meta.env` at build time; guard for SSR/tests.
  const key = `VITE_FORCE_FEATURE_${name.toUpperCase()}`;
  const raw = typeof import.meta !== 'undefined' ? import.meta.env?.[key] : undefined;
  if (raw === undefined || raw === '') return null;
  if (raw === 'true')  return true;
  if (raw === 'false') return false;
  return null;
}
