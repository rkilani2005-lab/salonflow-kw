import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowSuperAdmin?: boolean;
}

const ProtectedRoute = ({ children, allowSuperAdmin = false }: ProtectedRouteProps) => {
  const { user, tenant, userRoles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not logged in -> redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Super admins bypass onboarding and go to admin panel (unless allowSuperAdmin is true)
  const isSuperAdmin = userRoles.includes('super_admin' as any);
  if (isSuperAdmin && !allowSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // Logged in but no tenant (hasn't completed onboarding) - skip for super admins
  if (!isSuperAdmin && !tenant?.onboarding_completed && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // If on a protected route and authenticated with tenant, allow access
  // Redirect to dashboard if somehow landing on root
  if (location.pathname === '/') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;