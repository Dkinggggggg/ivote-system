import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wraps admin-only routes in App.jsx. Public Viewer routes (the results
// page) never use this - only Admin/Committee Officer pages need auth.
export default function ProtectedRoute() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
