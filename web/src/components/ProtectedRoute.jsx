import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wraps admin-only routes in App.jsx. Public Viewer routes (the results
// page) never use this - only Admin/Committee Officer pages need auth.
export default function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();
  const scannerRoutes = ['/scanner', '/scanner-monitoring'];

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin' && user.must_change_password) {
    return <Navigate to="/login" replace />;
  }

  if (scannerRoutes.includes(location.pathname) && user.role !== 'committee_officer') {
    return <Navigate to={user.role === 'admin' ? '/dashboard' : '/login'} replace />;
  }

  return <Outlet />;
}
