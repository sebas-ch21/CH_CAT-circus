import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User as UserIcon, LayoutDashboard, Users, ShieldCheck } from 'lucide-react';

export function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

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
    <nav className="bg-[#0F172A] text-white px-4 sm:px-6 py-3 flex justify-between items-center shadow-md w-full relative z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-[#007C8C] rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">C</div>
          <span className="font-black text-lg tracking-wide hidden md:block">Charlie Admissions</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 ml-4 bg-white/5 rounded-xl p-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/5">
          <UserIcon className="w-3.5 h-3.5 text-[#4DD9E8]" />
          <span className="text-xs font-bold tracking-wide hidden sm:inline">{user.email?.split('@')[0]}</span>
          <span className="text-[9px] uppercase tracking-widest bg-[#007C8C] px-2 py-0.5 rounded-md font-black shadow-sm">{user.role}</span>
        </div>

        <button onClick={logout} className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10">
          <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </nav>
  );
}
