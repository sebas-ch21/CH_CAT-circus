import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useEffect } from 'react';

export function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Fire a toast notification if the user hits a route they don't have access to
  useEffect(() => {
    if (!loading && user && requiredRole) {
      if (requiredRole === 'ADMIN' && user.role !== 'ADMIN') {
        toast.error('Unauthorized: Admin access required.');
      } else if (requiredRole === 'MANAGER' && !['ADMIN', 'MANAGER'].includes(user.role)) {
        toast.error('Unauthorized: Manager access required.');
      }
    }
  }, [user, loading, requiredRole, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#5E4791] border-t-transparent shadow-sm"></div>
      </div>
    );
  }

  // Not logged in? Send back to login door.
  if (!user) return <Navigate to="/" replace />;

  // Enforce Admin strict access
  if (requiredRole === 'ADMIN' && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  // Enforce Manager strict access (Admins inherit manager access)
  if (requiredRole === 'MANAGER' && !['ADMIN', 'MANAGER'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // If all checks pass, render the protected component
  return children;
}