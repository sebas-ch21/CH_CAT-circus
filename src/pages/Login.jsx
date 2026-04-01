import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CircleAlert as AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Strict validation: requires text, @ symbol, text, a dot, and text.
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidEmail) return; 
    
    setError('');
    setLoading(true);

    // This simulates sending the OTP code and logging in
    const result = await login(email);
    if (result.success) {
      const user = result.user;
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'MANAGER') navigate('/manager');
      else if (user.role === 'IC') navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleGoogleSSO = () => {
    // UI placeholder for real Google SSO
    setError('Google SSO requires adding API keys in the Supabase dashboard first.');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <Shield className="w-10 h-10 text-[#0F172A]" strokeWidth={2.5} />
            <h1 className="text-3xl font-semibold text-[#0F172A]">Charlie Admissions</h1>
          </div>
          <p className="text-gray-600">Welcome back to the dispatcher system</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@clinic.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0F172A] focus:border-transparent outline-none transition"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!isValidEmail || loading}
              className={`w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
                isValidEmail 
                  ? 'bg-[#5E4791] hover:bg-[#4A3770] text-white shadow-md cursor-pointer' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <><Loader className="w-5 h-5 animate-spin" /> Sending Code...</>
              ) : (
                'Send Login Code'
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-sm text-gray-400 font-medium">OR</span>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>

          <button
            onClick={handleGoogleSSO}
            type="button"
            className="mt-6 w-full bg-white border-2 border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}