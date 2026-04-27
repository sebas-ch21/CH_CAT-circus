import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { AdminPanel } from './pages/AdminPanel';
import { ManagerCenter } from './pages/ManagerCenter';
import { ICDashboard } from './pages/ICDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

// This intelligently decides where to send people who land on the root "yourwebsite.com/" URL
function RootRedirect() {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (!user) return <Login />;
  
  // If they are already logged in, skip the login screen and send them to their dashboard
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'MANAGER') return <Navigate to="/manager" replace />;
  return <Navigate to="/dashboard" replace />;
}

// 404 Catch-All Page
function NotFound() {
  return (
    <div className="ch-paper min-h-[100dvh] flex flex-col items-center justify-center text-center px-6">
      <div className="w-20 h-20 bg-[#CFE4EB] text-[#005682] rounded-2xl flex items-center justify-center font-display text-3xl mb-8 border border-[#EDE7DE]">
        404
      </div>
      <h1 className="font-display text-[44px] sm:text-[56px] leading-[1.05] text-[#12142A] mb-4 max-w-xl tracking-tight">
        This page isn't on the map.
      </h1>
      <p className="text-[#58534C] font-medium text-base mb-10 max-w-md leading-relaxed">
        The URL you requested doesn't exist, has been moved, or you don't have permission to view it.
      </p>
      <a
        href="/"
        className="px-8 py-3.5 bg-[#12142A] text-[#FAF8F5] font-semibold rounded-xl hover:bg-[#011537] transition-colors ch-focus-ring"
      >
        Return to dashboard
      </a>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
          {/* Base URL */}
          <Route path="/" element={<RootRedirect />} />
          
          {/* Strictly Admin Only */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminPanel />
              </ProtectedRoute>
            } 
          />
          
          {/* Admins and Managers can access the Dispatch Center */}
          <Route 
            path="/manager" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <ManagerCenter />
              </ProtectedRoute>
            } 
          />
          
          {/* Everyone can access the IC Dashboard (Admins might want to see how it looks) */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'IC']}>
                <ICDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* The Catch-All Asterisk catches any URL that isn't defined above */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;