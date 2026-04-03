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

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Hardcoded custom error message
    const customError = "User not in system, reach out to Clinical Admissions Leadership";

    // If email format is bad, immediately show the error and stop
    if (!isValidEmail) {
      setError(customError);
      return;
    }
    
    setError('');
    setLoading(true);

    const result = await login(email);
    if (result.success) {
      const user = result.user;
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'MANAGER') navigate('/manager');
      else if (user.role === 'IC') navigate('/dashboard');
    } else {
      // If Supabase says the user doesn't exist, show our custom error
      setError(customError);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <Shield className="w-10 h-10 text-[#0F172A]" strokeWidth={2.5} />
            <h1 className="text-3xl font-semibold text-[#0F172A]">CH Clinical Admissions Overflow</h1>
          </div>
          <p className="text-gray-600">Welcome back to the dispatch system</p>
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
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: '#5E4791', color: '#ffffff' }}
              className="w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader className="w-5 h-5 animate-spin" /> Signing In...</>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Demo users: admin@clinic.com, manager@clinic.com, ic1@clinic.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}