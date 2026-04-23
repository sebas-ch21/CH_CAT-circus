import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [isSupabaseAuth, setIsSupabaseAuth] = useState(false);

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
    } else {
      if (authUser) await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('charlie_test_user');
      localStorage.removeItem('charlie_pin_verified');
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithMagicLink = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
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
    <AuthContext.Provider value={{ user, loginWithMagicLink, loginWithPin, logout, loading, isPinVerified, isSupabaseAuth, verifyPin }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
export const useAuth = () => useContext(AuthContext);
