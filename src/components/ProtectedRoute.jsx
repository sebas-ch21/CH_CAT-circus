import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from 'lucide-react';

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1. Show a loading spinner while Supabase checks the session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-12 h-12 animate-spin text-[#5E4791]" />
      </div>
    );
  }

  // 2. If no user is found, kick them to the login screen
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 3. If they are logged in, but their role is NOT in the allowedRoles array
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Send them back to their appropriate home page
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'MANAGER') return <Navigate to="/manager" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  // 4. Everything checks out, let them in!
  return children;
}