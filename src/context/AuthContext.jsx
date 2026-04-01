import { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('clinicalUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    const storedPinVerified = localStorage.getItem('pinVerified');
    if (storedPinVerified === 'true') {
      setIsPinVerified(true);
    }
    setLoading(false);
  }, []);

  const login = async (email) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        localStorage.setItem('clinicalUser', JSON.stringify(data));
        setUser(data);
        return { success: true, user: data };
      } else {
        return { success: false, error: 'User not found. Please check your email.' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('clinicalUser');
    localStorage.removeItem('pinVerified');
    setUser(null);
    setIsPinVerified(false);
  };

  const verifyPin = async (inputPin) => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'access_pin')
        .maybeSingle();

      if (error) throw error;

      if (data && data.setting_value === inputPin) {
        setIsPinVerified(true);
        localStorage.setItem('pinVerified', 'true');
        return { success: true };
      } else {
        return { success: false, error: 'Incorrect PIN' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isPinVerified, verifyPin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
