import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User as UserIcon, LayoutDashboard, Users, ShieldCheck } from 'lucide-react';

function ShieldMark({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path
        d="M12 2.5 4 5.25v6.3c0 4.95 3.37 8.56 8 10.45 4.63-1.89 8-5.5 8-10.45v-6.3L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 10.5 12 14l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
    <nav
      className="bg-[#12142A] text-[#FAF8F5] px-4 sm:px-8 py-4 flex justify-between items-center w-full relative z-50 border-b border-[#011537]"
    >
      <div className="flex items-center gap-4 sm:gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FAF8F5] text-[#12142A]">
            <ShieldMark className="w-5 h-5" />
          </div>
          <div className="hidden lg:flex flex-col leading-tight">
            <span className="font-display text-[20px] text-[#FAF8F5]">Charlie Admissions</span>
            <span className="text-[10px] uppercase tracking-micro text-[#A8C8C2] font-medium">Capacity & Dispatch</span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#FAF8F5]/5 rounded-full p-1 border border-[#FAF8F5]/10 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ch-focus-ring ${
                  isActive
                    ? 'bg-[#FAF8F5] text-[#12142A]'
                    : 'text-[#CFE4EB] hover:text-[#FAF8F5] hover:bg-[#FAF8F5]/10'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span className="hidden sm:block">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5 shrink-0 ml-2">
        <div className="flex items-center gap-2.5 bg-[#FAF8F5]/5 pl-3 pr-2 py-1.5 rounded-full border border-[#FAF8F5]/10">
          <UserIcon className="w-4 h-4 text-[#5A9EBD] shrink-0" strokeWidth={2} />
          <span className="text-sm font-medium tracking-tight hidden md:block text-[#FAF8F5]">
            {user.email?.split('@')[0]}
          </span>
          <span className="text-[10px] uppercase tracking-micro bg-[#005682] text-[#FAF8F5] px-2 py-1 rounded-full font-semibold">
            {user.role}
          </span>
        </div>

        <button
          onClick={logout}
          className="text-sm font-semibold text-[#A8C8C2] hover:text-[#FAF8F5] flex items-center gap-2 transition-colors px-3 py-2 rounded-full hover:bg-[#FAF8F5]/10 ch-focus-ring"
        >
          <LogOut className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </nav>
  );
}
