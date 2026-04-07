import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader, MailCheck, KeyRound } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [usePin, setUsePin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const { user, loginWithMagicLink, loginWithPin } = useAuth();
  const navigate = useNavigate();

  // FIX: Redirection Logic
  // As soon as 'user' becomes populated (login successful), route them to the dashboard!
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'MANAGER') navigate('/manager');
      else if (user.role === 'IC') navigate('/ic');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (usePin) {
        // Call the new, working loginWithPin function from the Context
        await loginWithPin(email, pin);
      } else {
        // Call the new, working loginWithMagicLink function from the Context
        await loginWithMagicLink(email);
        setSuccess(true);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Shield className="w-16 h-16 text-[#0F172A] mx-auto mb-6" strokeWidth={2.5} />
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">
          Charlie Admissions
        </h2>
        <p className="mt-2 text-sm font-medium text-gray-500 uppercase tracking-widest">
          Capacity Circus & Dispatch
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-8 shadow-2xl rounded-3xl border border-gray-100">
          <p className="text-center text-gray-600 font-medium mb-8">
            Please sign in using your company email to continue.
          </p>

          {success ? (
            <div className="text-center p-6 bg-green-50 rounded-xl border border-green-100 animate-in zoom-in duration-300">
              <MailCheck className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-green-900 mb-2">Check your email</h3>
              <p className="text-sm text-green-700 font-medium">
                We've sent a magic login link to <strong>{email}</strong>.
              </p>
              <button onClick={() => setSuccess(false)} className="mt-6 text-sm font-bold text-[#5E4791] hover:underline">
                Try a different email
              </button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-[#5E4791] outline-none transition-colors"
                  placeholder="name@clinic.com"
                />
              </div>

              {usePin && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Test PIN</label>
                  <input
                    type="password" 
                    value={pin} 
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-[#5E4791] outline-none transition-colors"
                    placeholder="Enter PIN (IC users leave blank)"
                  />
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-xl text-center">
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-[#0F172A] rounded-2xl text-white font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? <Loader className="w-6 h-6 animate-spin" /> : (usePin ? 'Login with PIN' : 'Send Magic Link')}
              </button>
            </form>
          )}

          {!success && (
            <button 
              onClick={() => setUsePin(!usePin)} 
              type="button"
              className="mt-8 w-full text-center text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" /> {usePin ? 'Switch to Magic Link' : 'Test User? Login with PIN'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}