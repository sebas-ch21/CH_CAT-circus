import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader, MailCheck, KeyRound, Building2 } from 'lucide-react';
import { useFeatureFlag, FEATURES } from '../lib/integrations/featureFlags';
import { getOktaAdapter } from '../lib/integrations';

function ShieldMark({ className = 'w-14 h-14' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path
        d="M24 4 8 9.5v12.6c0 9.9 6.8 17.12 16 20.9 9.2-3.78 16-11 16-20.9V9.5L24 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 20 24 27.5 31.5 20M16.5 26 24 33.5 31.5 26"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [usePin, setUsePin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { user, loginWithMagicLink, loginWithPin, loginWithOkta } = useAuth();
  const navigate = useNavigate();

  // Okta SSO button visibility requires both the feature flag AND a
  // configured adapter (env var / Supabase SSO provider wired up).
  // This prevents an empty button appearing in environments where the
  // flag is on but credentials have not yet been provisioned.
  const oktaEnabled = useFeatureFlag(FEATURES.OKTA_SSO);
  const oktaAdapter = getOktaAdapter();
  const showOktaButton = oktaEnabled && oktaAdapter.isConfigured();


  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'MANAGER') navigate('/manager');
      else navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (usePin) {
        await loginWithPin(email, pin);
      } else {
        await loginWithMagicLink(email);
        setSuccess(true);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ch-paper min-h-[100dvh] flex flex-col justify-center py-12 px-6 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(closest-side, #005682 0%, transparent 70%), radial-gradient(closest-side, #495654 0%, transparent 70%)',
          backgroundSize: '900px 900px, 700px 700px',
          backgroundPosition: 'top right, bottom left',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#12142A] text-[#FAF8F5] mb-6 ch-rise">
          <ShieldMark className="w-9 h-9" />
        </div>
        <h1 className="font-display text-[44px] sm:text-[52px] text-[#12142A] tracking-tight">
          Charlie Admissions
        </h1>
        <p className="mt-2 text-[11px] text-[#58534C] uppercase tracking-micro font-semibold">
          Capacity Circus &middot; Dispatch
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative">
        <div className="ch-card p-8 sm:p-10 ch-rise">
          {success ? (
            <div className="text-center p-6 bg-[#E8F0EE] rounded-xl border border-[#A8C8C2]">
              <MailCheck className="w-10 h-10 text-[#335649] mx-auto mb-3" strokeWidth={1.8} />
              <h3 className="font-display text-2xl text-[#12142A] mb-2">Check your inbox</h3>
              <p className="text-sm text-[#495654] font-medium">
                Magic sign-in link sent to <strong className="text-[#12142A]">{email}</strong>.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="mt-6 text-sm font-semibold text-[#005682] hover:text-[#011537] hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-[11px] font-semibold text-[#58534C] mb-2 uppercase tracking-micro">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FAF8F5] border border-[#D7D1C8] rounded-xl font-medium text-[#12142A] placeholder:text-[#A29A8E] focus:border-[#005682] focus:bg-white outline-none transition-colors"
                  placeholder="name@clinic.com"
                />
              </div>

              {usePin && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#58534C] mb-2 uppercase tracking-micro">
                    Test PIN
                  </label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-4 py-3 bg-[#FAF8F5] border border-[#D7D1C8] rounded-xl font-medium text-[#12142A] placeholder:text-[#A29A8E] focus:border-[#005682] focus:bg-white outline-none transition-colors"
                    placeholder="Enter PIN (IC users leave blank)"
                  />
                </div>
              )}

              {error && (
                <div className="px-4 py-3 bg-[#FDEBEC] text-[#9F2F2D] text-sm font-semibold rounded-xl border border-[#F2C9CC]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-[#FAF8F5] bg-[#12142A] hover:bg-[#011537] disabled:opacity-50 transition-colors flex justify-center items-center gap-2 ch-focus-ring"
              >
                {loading ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  usePin ? 'Sign in with PIN' : 'Send magic link'
                )}
              </button>
            </form>
          )}

          {!success && showOktaButton && (
            <div className="mt-6">
              {/*
                Divider + Okta button. Only rendered when the `okta_sso`
                feature flag is on AND the adapter reports itself
                configured — see showOktaButton computation above.
              */}
              <div className="flex items-center gap-3 my-4">
                <span className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">or</span>
                <span className="flex-1 h-px bg-gray-200" />
              </div>
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  try {
                    await loginWithOkta();
                  } catch (err) {
                    setError(err.message || 'Okta login failed.');
                  }
                }}
                className="w-full py-3 rounded-xl font-semibold border border-[#12142A] text-[#12142A] hover:bg-[#12142A] hover:text-[#FAF8F5] transition-colors flex items-center justify-center gap-2"
              >
                <Building2 className="w-5 h-5" /> Sign in with Okta
              </button>
            </div>
          )}

          {!success && (
            <button
              onClick={() => setUsePin(!usePin)}
              type="button"
              className="mt-7 w-full text-center text-sm font-semibold text-[#58534C] hover:text-[#12142A] flex items-center justify-center gap-2 transition-colors"
            >
              <KeyRound className="w-4 h-4" strokeWidth={1.8} />
              {usePin ? 'Switch to magic link' : 'Test user? Sign in with PIN'}
            </button>
          )}
        </div>
        <p className="text-center mt-6 text-[11px] text-[#58534C] uppercase tracking-micro font-semibold">
          Care can be felt in everything we do
        </p>
      </div>
    </div>
  );
}
