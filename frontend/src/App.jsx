import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfigProvider, theme } from 'antd';

import Login      from './pages/Auth/Login';
import Signup     from './pages/Auth/Signup';
import Landing    from './pages/Home/Landing';
import UserMenu   from './pages/User/UserMenu';
import Rewards    from './pages/User/Rewards';
import Dashboard  from './pages/Admin/Dashboard';
import AdminMenu  from './pages/Admin/AdminMenu';
import AdminSales from './pages/Admin/AdminSales';
import AdminInventory from './pages/Admin/AdminInventory';

// ── Protect routes based on login + role ──────────────────
function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/menu'} replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/menu'} replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"       element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/login"  element={<PublicRoute><Login  /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

      {/* User */}
      <Route path="/menu"    element={<ProtectedRoute role="user"><UserMenu /></ProtectedRoute>} />
      <Route path="/rewards" element={<ProtectedRoute role="user"><Rewards  /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><Dashboard /></ProtectedRoute>} />
      <Route path="/admin/inventory" element={<ProtectedRoute role="admin"><AdminInventory /></ProtectedRoute>} />
      <Route path="/admin/menu"      element={<ProtectedRoute role="admin"><AdminMenu  /></ProtectedRoute>} />
      <Route path="/admin/sales"     element={<ProtectedRoute role="admin"><AdminSales /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#3a6b1e', // Green 600
          colorInfo: '#3a6b1e',
          colorSuccess: '#4a8028',
          colorWarning: '#e07040',
          colorError: '#dc2626',
          fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
          borderRadius: 8,
          colorBgBase: '#fdfaf4', // Beige 50
        },
        components: {
          Button: {
            colorPrimary: '#3a6b1e',
            colorPrimaryHover: '#4a8028',
            colorPrimaryActive: '#2d5016',
          },
        },
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}
