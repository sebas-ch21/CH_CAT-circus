import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from 'lucide-react';

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1. Wait for Supabase to confirm if the user is actually logged in
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-12 h-12 animate-spin text-[#5E4791]" />
      </div>
    );
  }

  // 2. If they are completely logged out, kick them to the login page
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 3. If this route requires specific roles, check if the user has permission
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // They are logged in, but unauthorized for this specific page. Bounce them back to their home.
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'MANAGER') return <Navigate to="/manager" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  // 4. They passed all security checks. Let them see the page.
  return children;
}