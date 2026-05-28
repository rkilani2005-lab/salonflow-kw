import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowSuperAdmin?: boolean;
}

const ProtectedRoute = ({ children, allowSuperAdmin = false }: ProtectedRouteProps) => {
  const { user, tenant, userRoles, loading } = useAuth();
  const location = useLocation();
  const ent = useEntitlements();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const isSuperAdmin = userRoles.includes('super_admin' as any);

  if (isSuperAdmin && !allowSuperAdmin) {
    return <Navigate to="/zaina-admin" replace />;
  }

  const needsOnboarding =
    !isSuperAdmin && !tenant?.id && location.pathname !== '/onboarding';

  const onboardingIncomplete =
    !isSuperAdmin && !!tenant?.id &&
    tenant.onboarding_completed === false &&
    location.pathname !== '/onboarding';

  if (needsOnboarding || onboardingIncomplete) {
    return <Navigate to="/onboarding" replace />;
  }

  // Subscription hard-gate: expired trial + no active sub → /subscription only.
  // Always allow the subscription page itself, settings, and auth flows.
  const allowedWhenExpired = ['/subscription', '/settings', '/auth', '/onboarding'];
  const isAllowedPath = allowedWhenExpired.some(p => location.pathname.startsWith(p));
  if (
    !isSuperAdmin &&
    !ent.loading &&
    ent.status === 'expired' &&
    !isAllowedPath
  ) {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
