import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User as UserIcon, LayoutDashboard, Users, ShieldCheck } from 'lucide-react';

export function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide nav entirely if not logged in
  if (!user) return null;

  // Dynamically build global navigation tabs based on user role
  const navItems = [];
  if (user.role === 'ADMIN') {
    navItems.push({ label: 'Admin', path: '/admin', icon: ShieldCheck });
    navItems.push({ label: 'Manager', path: '/manager', icon: Users });
    navItems.push({ label: 'IC View', path: '/dashboard', icon: LayoutDashboard });
  } else if (user.role === 'MANAGER') {
    navItems.push({ label: 'Manager', path: '/manager', icon: Users });
    navItems.push({ label: 'IC View', path: '/dashboard', icon: LayoutDashboard });
  } else {
    navItems.push({ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard });
  }

  return (
    <nav className="bg-[#0F172A] text-white px-4 sm:px-6 py-4 flex justify-between items-center shadow-md w-full relative z-50">
      <div className="flex items-center gap-2 sm:gap-6">
        
        {/* Company Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 bg-[#5E4791] rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">C</div>
          <span className="font-black text-lg tracking-wide hidden lg:block">Charlie Admissions</span>
        </div>

        {/* Global Role-Based Navigation Links */}
        <div className="flex items-center gap-1 sm:gap-2 bg-white/5 rounded-xl p-1.5 shadow-inner overflow-x-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#5E4791] text-white shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:block">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* User Profile & Logout */}
      <div className="flex items-center gap-3 sm:gap-6 shrink-0 ml-2">
        <div className="flex items-center gap-2 bg-white/10 px-3 sm:px-4 py-2 rounded-xl border border-white/5 shadow-inner">
          <UserIcon className="w-4 h-4 text-[#A890D3] shrink-0" />
          <span className="text-sm font-bold tracking-wide hidden md:block">{user.email?.split('@')[0]}</span>
          <span className="text-[10px] uppercase tracking-widest bg-[#5E4791] px-2 py-1 rounded-md font-black shadow-sm">{user.role}</span>
        </div>
        
        <button 
          onClick={logout} 
          className="text-sm font-bold text-gray-400 hover:text-white flex items-center gap-2 transition-colors px-2 py-2 rounded-lg hover:bg-white/10"
        >
          <LogOut className="w-4 h-4 shrink-0" /> 
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </nav>
  );
}