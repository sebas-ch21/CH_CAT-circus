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
        await verifyAgainstRoster(session.user.email, session.user);
      } else {
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
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await verifyAgainstRoster(session.user.email, session.user);
    } else {
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
      const sessionUser = authUser ? { ...authUser, ...profile } : profile;
      setUser(sessionUser);
      
      if (!authUser) {
        localStorage.setItem('charlie_test_user', JSON.stringify(sessionUser));
      }
    } else {
      if (authUser) await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('charlie_test_user');
    }
  };

  const loginWithMagicLink = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
  };

  const loginWithPin = async (email, pin) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!profile) throw new Error('Email not found in the roster.');

    const { data: settings } = await supabase.from('app_settings').select('*');
    const adminPin = settings.find(s => s.setting_key === 'admin_pin')?.setting_value || 'charlieadmin';
    const managerPin = settings.find(s => s.setting_key === 'manager_pin')?.setting_value || 'charliemanager';

    let isValid = false;
    if (profile.role === 'ADMIN' && pin === adminPin) isValid = true;
    else if (profile.role === 'MANAGER' && pin === managerPin) isValid = true;
    else if (profile.role === 'IC') isValid = true; 

    if (!isValid) throw new Error('Invalid PIN for this role.');

    await verifyAgainstRoster(email);
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