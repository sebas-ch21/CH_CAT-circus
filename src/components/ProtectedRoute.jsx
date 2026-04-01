import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Eye, EyeOff } from 'lucide-react';

export function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, isPinVerified, verifyPin } = useAuth();
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007C8C]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const hasRoleAccess = () => {
    if (requiredRole === 'MANAGER') {
      return ['ADMIN', 'MANAGER'].includes(user.role);
    }
    if (requiredRole === 'ADMIN') {
      return user.role === 'ADMIN';
    }
    return true;
  };

  if (!hasRoleAccess()) {
    return <Navigate to="/dashboard" replace />;
  }

  const needsPinVerification = (requiredRole === 'ADMIN' || requiredRole === 'MANAGER') && !isPinVerified;

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setPinError('');
    setVerifying(true);

    const result = await verifyPin(pinInput);

    if (!result.success) {
      setPinError(result.error || 'Incorrect PIN');
      setPinInput('');
    }

    setVerifying(false);
  };

  if (needsPinVerification) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"></div>

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
          <div className="bg-[#0F172A] text-white px-8 py-6 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Secure Access Required</h2>
            </div>
            <p className="text-gray-300 mt-2">Enter your access PIN to continue</p>
          </div>

          <form onSubmit={handlePinSubmit} className="p-8">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Access PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5E4791] focus:border-transparent"
                  placeholder="Enter PIN"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {pinError && (
                <p className="text-red-600 text-sm mt-2">{pinError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!pinInput || verifying}
              className="w-full bg-[#5E4791] hover:bg-[#4a3773] disabled:bg-gray-300 disabled:text-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-all"
            >
              {verifying ? 'Verifying...' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return children;
}