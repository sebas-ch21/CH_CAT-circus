import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Eye, EyeOff, Loader } from 'lucide-react';

export function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, isPinVerified, verifyPin } = useAuth();
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F172A]"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  // Enforce standard role access
  if (requiredRole === 'MANAGER' && !['ADMIN', 'MANAGER'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requiredRole === 'ADMIN' && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  // The Lock Screen
  if (requiredRole && !isPinVerified) {
    const handleUnlock = async (e) => {
      e.preventDefault();
      setVerifying(true);
      setPinError('');
      
      const result = await verifyPin(pinInput, requiredRole);
      
      if (!result.success) {
        setPinError(result.error);
      }
      setVerifying(false);
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 w-full max-w-sm">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-[#0F172A] rounded-full flex items-center justify-center mb-4">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[#0F172A]">Secure Access</h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter the {requiredRole === 'ADMIN' ? 'Admin' : 'Manager'} PIN to continue
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-5">
            <div>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter PIN"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0F172A] focus:border-transparent outline-none pr-12 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {pinError && <p className="text-red-500 text-sm mt-2 font-medium">{pinError}</p>}
            </div>

            <button
              type="submit"
              disabled={!pinInput || verifying}
              className="w-full bg-[#5E4791] hover:bg-[#4A3770] text-white font-bold py-3.5 rounded-xl transition-all shadow-md disabled:opacity-70 flex items-center justify-center"
            >
              {verifying ? <Loader className="w-5 h-5 animate-spin" /> : 'Unlock Workspace'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // If they pass the PIN check, show the actual page
  return children;
}