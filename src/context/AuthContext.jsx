import { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false); // Tracks if the user passed the PIN screen

  useEffect(() => {
    const storedUser = localStorage.getItem('clinicalUser');
    if (storedUser) setUser(JSON.parse(storedUser));
    setLoading(false);
  }, []);

  const login = async (email) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
      if (error) throw error;
      if (data) {
        localStorage.setItem('clinicalUser', JSON.stringify(data));
        setUser(data);
        return { success: true, user: data };
      } else {
        return { success: false, error: 'User not in system, reach out to Clinical Admissions Leadership' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('clinicalUser');
    setUser(null);
    setIsPinVerified(false); // Lock the screens again on logout
  };

  const verifyPin = async (inputPin, requiredRole) => {
    // 1. Determine which PIN we are checking for
    const key = requiredRole === 'ADMIN' ? 'admin_pin' : 'manager_pin';
    const fallbackPin = requiredRole === 'ADMIN' ? 'charlieadmin' : 'charliemanager';

    try {
      // 2. Try to get the custom PIN from the database
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', key)
        .maybeSingle();

      const correctPin = data?.setting_value || fallbackPin;

      // 3. Check if it matches
      if (inputPin === correctPin) {
        setIsPinVerified(true);
        return { success: true };
      }
      return { success: false, error: 'Incorrect PIN' };
      
    } catch (err) {
      // 4. FAIL-SAFE: If the database table doesn't exist yet, use the hardcoded defaults
      if (inputPin === fallbackPin) {
        setIsPinVerified(true);
        return { success: true };
      }
      return { success: false, error: 'Incorrect PIN' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isPinVerified, login, logout, verifyPin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}