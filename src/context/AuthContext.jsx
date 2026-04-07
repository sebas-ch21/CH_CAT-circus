import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await verifyAgainstRoster(session.user.email, session.user);
      } else {
        const testUser = localStorage.getItem('charlie_test_user');
        if (testUser) {
          setUser(JSON.parse(testUser));
          if (localStorage.getItem('charlie_pin_verified')) setIsPinVerified(true);
        }
      }
      setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          await verifyAgainstRoster(session.user.email, session.user);
        } else if (!localStorage.getItem('charlie_test_user')) {
          setUser(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

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

    const { data: settings } = await supabase.from('app_settings').select('*');
    const adminPin = settings?.find(s => s.setting_key === 'admin_pin')?.setting_value || 'charlieadmin';
    const managerPin = settings?.find(s => s.setting_key === 'manager_pin')?.setting_value || 'charliemanager';

    let isValid = false;
    if (profile.role === 'ADMIN' && pin === adminPin) isValid = true;
    else if (profile.role === 'MANAGER' && pin === managerPin) isValid = true;
    else if (profile.role === 'IC') isValid = true;

    if (!isValid) throw new Error('Invalid PIN for this role.');

    await verifyAgainstRoster(email);
    setIsPinVerified(true);
    localStorage.setItem('charlie_pin_verified', 'true');
  };

  const verifyPin = async (pin, requiredRole) => {
    const { data: settings } = await supabase.from('app_settings').select('*');
    const adminPin = settings?.find(s => s.setting_key === 'admin_pin')?.setting_value || 'charlieadmin';
    const managerPin = settings?.find(s => s.setting_key === 'manager_pin')?.setting_value || 'charliemanager';
    const targetPin = requiredRole === 'ADMIN' ? adminPin : managerPin;

    if (pin === targetPin) {
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
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loginWithMagicLink, loginWithPin, logout, loading, isPinVerified, verifyPin }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
export const useAuth = () => useContext(AuthContext);
