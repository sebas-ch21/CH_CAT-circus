import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // If a real Magic Link session exists, verify them against the roster
        await verifyAgainstRoster(session.user.email, session.user);
      } else {
        // If no real session exists, check if they are a test user before wiping state
        const testUser = localStorage.getItem('charlie_test_user');
        if (!testUser) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    // 1. Try to get a real Supabase Magic Link session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await verifyAgainstRoster(session.user.email, session.user);
    } else {
      // 2. Fallback: Check local storage for a PIN-based test user
      const testUser = localStorage.getItem('charlie_test_user');
      if (testUser) {
        setUser(JSON.parse(testUser));
      }
      setLoading(false);
    }
  };

  const verifyAgainstRoster = async (email, authUser = null) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (profile) {
      // Merge auth data with your custom role/tier roster data
      const sessionUser = authUser ? { ...authUser, ...profile } : profile;
      setUser(sessionUser);
      
      // If it's a test user (no authUser), save them to local storage
      if (!authUser) {
        localStorage.setItem('charlie_test_user', JSON.stringify(sessionUser));
      }
    } else {
      // Roster lookup failed or email not found
      if (authUser) await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('charlie_test_user');
    }
  };

  // --- MAGIC LINK LOGIN ---
  const loginWithMagicLink = async (email) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({ 
        email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (error) {
      throw new Error(`Magic Link error: ${error.message}`);
    }
  };

  // --- LEGACY PIN LOGIN (For Testing) ---
  const loginWithPin = async (email, pin) => {
    try {
      // 1. Find them in the roster
      const { data: profile, error: rosterError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (rosterError) throw rosterError;
      if (!profile) throw new Error('Email not found in the roster.');

      // 2. Load settings for PIN verification
      const { data: settings, error: settingsError } = await supabase.from('app_settings').select('*');
      if (settingsError) throw settingsError;

      const adminPin = settings.find(s => s.setting_key === 'admin_pin')?.setting_value || 'charlieadmin';
      const managerPin = settings.find(s => s.setting_key === 'manager_pin')?.setting_value || 'charliemanager';

      // 3. Perform role-based PIN check
      let isValid = false;
      if (profile.role === 'ADMIN' && pin === adminPin) isValid = true;
      else if (profile.role === 'MANAGER' && pin === managerPin) isValid = true;
      else if (profile.role === 'IC') isValid = true; // ICs can bypass strict PINs

      if (!isValid) throw new Error('Invalid PIN for this role.');

      // 4. Verification successful, log them in as a local test user
      await verifyAgainstRoster(email);
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('charlie_test_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loginWithMagicLink, loginWithPin, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);