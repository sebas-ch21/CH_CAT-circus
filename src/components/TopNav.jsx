import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const canAccessAdmin = user?.role === 'ADMIN';
  const canAccessManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // This applies the gray box to whichever page you are currently on
  const getNavClass = (path) => {
    const isActive = location.pathname === path;
    return `px-4 py-2 text-sm transition-all rounded-lg ${
      isActive
        ? 'bg-gray-200 text-gray-900 font-bold shadow-sm'
        : 'text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900'
    }`;
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-[#007C8C]" strokeWidth={2} />
              <h1 className="text-xl font-semibold text-gray-900">Charlie Admissions</h1>
            </div>

            <div className="flex items-center gap-2">
              {canAccessAdmin && (
                <button onClick={() => navigate('/admin')} className={getNavClass('/admin')}>
                  Admin Mode
                </button>
              )}
              {canAccessManager && (
                <button onClick={() => navigate('/manager')} className={getNavClass('/manager')}>
                  Manager Mode
                </button>
              )}
              <button onClick={() => navigate('/dashboard')} className={getNavClass('/dashboard')}>
                IC Mode
              </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}