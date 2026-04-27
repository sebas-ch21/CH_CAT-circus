import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getOktaAdapter } from '../lib/integrations';
import { isFeatureEnabledAsync, FEATURES } from '../lib/integrations/featureFlags';
import { recordAudit } from '../lib/integrations/auditLog';

const AuthContext = createContext({});

/**
 * `AuthContext` supports three login paths that coexist intentionally:
 *   1. Magic Link      — original email OTP flow via Supabase Auth.
 *   2. Local PIN       — developer + break-glass flow for ADMIN/MANAGER.
 *   3. Okta OIDC SSO   — optional, gated behind the `okta_sso` feature flag.
 *
 * The Okta path reuses the Supabase Auth session machinery (the OIDC
 * callback lands as a normal Supabase session). Downstream code therefore
 * does not need to care which of (1) or (3) produced the session — we
 * still `verifyAgainstRoster` and JIT-provision profiles if necessary.
 */


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [isSupabaseAuth, setIsSupabaseAuth] = useState(false);

  /**
   * Calls the `auth-jit-sync` edge function (see
   * supabase/functions/auth-jit-sync) which inspects the OIDC claims
   * on the current Supabase session and creates/updates a `profiles`
   * row accordingly.
   *
   * Returns true when the function reported that a row exists after
   * the call (whether it was created just now or already there).
   */
  const tryOktaJitProvision = async (authUser) => {
    try {
      const oktaEnabled = await isFeatureEnabledAsync(FEATURES.OKTA_SSO);
      if (!oktaEnabled) return false;
      // Heuristic: Supabase Auth tags the provider on `app_metadata`.
      const provider = authUser?.app_metadata?.provider;
      if (provider && provider !== 'oidc' && provider !== 'okta') return false;

      const { data, error } = await supabase.functions.invoke('auth-jit-sync', {
        body: { email: authUser.email }
      });
      if (error) throw error;
      await recordAudit({
        source: 'auth',
        action: 'okta_jit',
        severity: data?.created ? 'info' : 'debug',
        actorEmail: authUser.email,
        payload: { created: data?.created ?? false }
      });
      return Boolean(data?.profileExists);
    } catch (err) {
      await recordAudit({
        source: 'auth',
        action: 'okta_jit_failed',
        severity: 'error',
        actorEmail: authUser?.email,
        payload: { message: err?.message ?? String(err) }
      });
      return false;
    }
  };

  const verifyAgainstRoster = async (email, authUser = null) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (profile) {
      const sessionUser = authUser ? { ...authUser, ...profile } : profile;
      setUser(sessionUser);
      if (!authUser) localStorage.setItem('charlie_test_user', JSON.stringify(sessionUser));
      return;
    }

    if (authUser) {
      // No roster row yet. If this session came from Okta SSO AND the
      // `okta_sso` feature flag is on, we attempt Just-In-Time
      // provisioning via the edge function. The edge function reads
      // `app_settings.okta_group_role_map` to decide the role.
      const jitCreated = await tryOktaJitProvision(authUser);
      if (jitCreated) {
        const { data: refetched } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email.toLowerCase())
          .maybeSingle();
        if (refetched) {
          setUser({ ...authUser, ...refetched });
          return;
        }
      }
      // Still no row → roster is the source of truth; sign the SSO user
      // back out so they cannot sit in a limbo state.
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('charlie_test_user');
    localStorage.removeItem('charlie_pin_verified');
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsSupabaseAuth(true);
        setIsPinVerified(true);
        await verifyAgainstRoster(session.user.email, session.user);
      } else {
        const testUser = localStorage.getItem('charlie_test_user');
        if (testUser) {
          try {
            const parsed = JSON.parse(testUser);
            if (localStorage.getItem('charlie_pin_verified')) setIsPinVerified(true);
            // Re-verify against the roster so a demoted/removed user can't retain a stale role from localStorage.
            await verifyAgainstRoster(parsed.email);
          } catch {
            localStorage.removeItem('charlie_test_user');
            localStorage.removeItem('charlie_pin_verified');
          }
        }
      }
      setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          setIsSupabaseAuth(true);
          setIsPinVerified(true);
          await verifyAgainstRoster(session.user.email, session.user);
        } else if (!localStorage.getItem('charlie_test_user')) {
          setUser(null);
          setIsSupabaseAuth(false);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithMagicLink = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
  };

  /**
   * Kicks off the Okta OIDC redirect via the configured adapter.
   * The adapter factory picks `oktaLiveAdapter` when
   * `VITE_OKTA_MODE=live`, otherwise the mock adapter logs and
   * returns immediately (handy for demo + tests).
   *
   * Does NOT short-circuit on the feature flag — the calling UI is
   * responsible for hiding the button. If the flag is off and an
   * attacker still POSTs to this function, Supabase Auth rejects the
   * SSO request anyway, so it is defensively safe.
   */
  const loginWithOkta = async () => {
    const oktaAdapter = getOktaAdapter();
    if (!oktaAdapter.isConfigured()) {
      throw new Error('Okta SSO is not configured for this environment.');
    }
    await oktaAdapter.signIn();
  };

  const loginWithPin = async (email, pin) => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (profileError || !profile) throw new Error('Email not found in the roster.');

    if (profile.role === 'IC') {
      // ICs don't need a PIN; their identity comes from the magic-link or trusted device.
    } else {
      const { data: ok, error: rpcError } = await supabase.rpc('fn_verify_pin', {
        p_role: profile.role,
        p_pin: pin,
      });
      if (rpcError) throw new Error('PIN verification failed. Please try again.');
      if (!ok) throw new Error('Invalid PIN for this role.');
    }

    await verifyAgainstRoster(email);
    setIsPinVerified(true);
    localStorage.setItem('charlie_pin_verified', 'true');
  };

  const verifyPin = async (pin, requiredRole) => {
    const { data: ok, error: rpcError } = await supabase.rpc('fn_verify_pin', {
      p_role: requiredRole,
      p_pin: pin,
    });
    if (rpcError) return { success: false, error: 'PIN verification failed.' };
    if (ok) {
      setIsPinVerified(true);
      localStorage.setItem('charlie_pin_verified', 'true');
      return { success: true };
    }
    return { success: false, error: 'Incorrect PIN. Please try again.' };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('charlie_test_user');
    localStorage.removeItem('charlie_pin_verified');
    setIsPinVerified(false);
    setIsSupabaseAuth(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loginWithMagicLink,
      loginWithPin,
      loginWithOkta,
      logout,
      loading,
      isPinVerified,
      isSupabaseAuth,
      verifyPin
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
export const useAuth = () => useContext(AuthContext);
