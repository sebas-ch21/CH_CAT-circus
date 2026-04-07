import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { AdminPanel } from './pages/AdminPanel';
import { ICDashboard } from './pages/ICDashboard';
import { ManagerCenter } from './pages/ManagerCenter';
import './index.css';

// Professional 404 Catch-All Component
const NotFound = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
    <h1 className="text-8xl font-black text-[#0F172A] mb-4">404</h1>
    <p className="text-xl text-gray-600 font-medium mb-8">Oops! The page you are looking for does not exist.</p>
    <Link to="/" className="bg-[#5E4791] text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-[#4a3872] transition-all">
      Return to Safety
    </Link>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          {/* Global Toast Notification System */}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                fontWeight: 'bold',
                borderRadius: '1rem',
                padding: '16px',
                color: '#0F172A',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              },
            }}
          />
          
          <Routes>
            <Route path="/" element={<Login />} />
            
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <ICDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/manager"
              element={
                <ProtectedRoute requiredRole="MANAGER">
                  <ManagerCenter />
                </ProtectedRoute>
              }
            />
            
            {/* Catch-All Route for Typos */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;