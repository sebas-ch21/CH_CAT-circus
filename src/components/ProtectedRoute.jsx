import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();

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

  // FIX: If the route requires MANAGER, allow both ADMIN and MANAGER
  if (requiredRole === 'MANAGER' && !['ADMIN', 'MANAGER'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // FIX: If the route requires ADMIN, strictly enforce ADMIN only
  if (requiredRole === 'ADMIN' && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}