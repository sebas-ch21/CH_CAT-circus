import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

export function TopNav() {
  const { user, logout } = useAuth();
  
  // Do not show the nav bar on the Login screen
  if (!user) return null;

  return (
    <nav className="bg-[#0F172A] text-white px-6 py-4 flex justify-between items-center shadow-md w-full relative z-50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[#5E4791] rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">C</div>
        <span className="font-black text-lg tracking-wide hidden sm:block">Charlie Admissions</span>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
          <UserIcon className="w-4 h-4 text-purple-300" />
          <span className="text-sm font-bold tracking-wide">{user.email?.split('@')[0]}</span>
          <span className="text-[10px] uppercase tracking-widest bg-[#5E4791] px-2 py-1 rounded-md ml-2 font-black shadow-sm">{user.role}</span>
        </div>
        
        <button onClick={logout} className="text-sm font-bold text-gray-300 hover:text-white flex items-center gap-2 transition-colors px-3 py-2 rounded-lg hover:bg-white/10">
          <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </nav>
  );
}