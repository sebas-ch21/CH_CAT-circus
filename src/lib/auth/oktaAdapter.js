/**
 * Okta (live) adapter
 * ---------------------------------------------------------------
 * Thin wrapper around Supabase Auth's built-in SSO support. When an
 * Okta OIDC provider is configured (see docs/GO_LIVE.md), calling
 * `signIn()` kicks off the OIDC redirect flow; the user lands back
 * on the app with a Supabase session whose `raw_user_meta_data.groups`
 * claim drives role resolution downstream.
 *
 * ## Contract (shared with oktaMockAdapter)
 *   - `isConfigured()`  → boolean  (UI hides the Okta button when false)
 *   - `signIn()`        → Promise<void>
 *   - `signOut()`       → Promise<void>
 *
 * Every adapter in this repo follows the same convention: identical
 * method signatures, so the UI never needs an `if mock` branch.
 */

import { supabase } from '../supabase';

const domain = import.meta.env?.VITE_OKTA_DOMAIN ?? '';

export const oktaLiveAdapter = {
  /**
   * We consider Okta "configured" when an operator has set the Okta
   * domain env var. The actual client credentials live on the Supabase
   * project (not the browser) so we cannot verify them from here.
   */
  isConfigured() {
    return Boolean(domain);
  },

  /**
   * Starts the OIDC redirect flow. Supabase Auth resolves the
   * provider by domain; see the Supabase SSO docs for the exact
   * relationship between domain and provider id.
   */
  async signIn() {
    if (!domain) {
      throw new Error('Okta domain is not configured. Set VITE_OKTA_DOMAIN.');
    }
    // `signInWithSSO` issues a 302 back to Okta; control never
    // returns to this promise under normal conditions.
    const { error } = await supabase.auth.signInWithSSO({ domain });
    if (error) throw error;
  },

  async signOut() {
    await supabase.auth.signOut();
  }
};
