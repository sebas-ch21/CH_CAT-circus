/**
 * Okta (mock) adapter
 * ---------------------------------------------------------------
 * Development + CI stand-in for `oktaLiveAdapter`. Returns the same
 * shape but never talks to Okta — `signIn()` resolves immediately
 * and the caller can verify the UI without any real OIDC config.
 *
 * The mock is deliberately chatty in the console so engineers wiring
 * up the UI notice when a real credential is missing.
 */

export const oktaMockAdapter = {
  isConfigured() {
    // Force true so the "Sign in with Okta" button appears during
    // local dev, giving designers / PMs a preview of the button UI.
    return true;
  },

  async signIn() {
    console.info(
      '[okta-mock] signIn called. In live mode this would 302 to Okta; ' +
        'here we do nothing. Toggle VITE_OKTA_MODE=live to test the real flow.'
    );
  },

  async signOut() {
    // Intentionally empty — the host app handles session cleanup in
    // `AuthContext.logout`.
  }
};
