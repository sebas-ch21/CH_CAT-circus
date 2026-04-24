import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { AdminPanel } from './pages/AdminPanel';
import { ManagerCenter } from './pages/ManagerCenter';
import { ICDashboard } from './pages/ICDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-6">
      <div className="w-20 h-20 bg-[#F3EFF9] text-[#5E4791] rounded-3xl flex items-center justify-center text-3xl font-black mb-6 shadow-sm border border-[#E7DFF3]">
        !?
      </div>
      <h1 className="text-4xl sm:text-5xl font-black text-[#0F172A] mb-4 tracking-tight">Lost in the Circus?</h1>
      <h2 className="text-xl font-bold text-gray-500 mb-8 max-w-md">
        The page you are looking for doesn't exist, has been moved, or you don't have permission to view it.
      </h2>
      <a href="/" className="px-8 py-4 bg-[#0F172A] text-white font-black rounded-xl hover:bg-gray-800 transition-all shadow-lg active:scale-95">
        Return to Safety
      </a>
    </div>
  );
}

function App() {
  return (
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
  );
}

export default App;