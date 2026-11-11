import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Spinner } from './Feedback';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!isAdmin) return <Navigate to="/projects" replace />;
  return <Outlet />;
}
