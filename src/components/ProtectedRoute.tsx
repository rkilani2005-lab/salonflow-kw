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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Not logged in → tenant auth page
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const isSuperAdmin = userRoles.includes('super_admin' as any);

  // Super admins do not belong in the tenant dashboard.
  // Route them to the admin panel unless the route explicitly allows super admin
  // (e.g. /whatsapp-agent which is shared).
  if (isSuperAdmin && !allowSuperAdmin) {
    return <Navigate to="/zaina-admin" replace />;
  }

  // Regular tenant user who hasn't finished onboarding
  if (!isSuperAdmin && !tenant?.onboarding_completed && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
