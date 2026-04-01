import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const canAccessAdmin = user?.role === 'ADMIN';
  const canAccessManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-charlie-teal" strokeWidth={2} />
              <h1 className="text-xl font-semibold text-gray-900">Charlie Admissions</h1>
            </div>

            <div className="flex items-center gap-2">
              {canAccessAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Admin Mode
                </button>
              )}
              {canAccessManager && (
                <button
                  onClick={() => navigate('/manager')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Manager Mode
                </button>
              )}
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                IC Mode
              </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
