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

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const isSuperAdmin = userRoles.includes('super_admin' as any);

  if (isSuperAdmin && !allowSuperAdmin) {
    return <Navigate to="/zaina-admin" replace />;
  }

  // Onboarding gate: only redirect if the user has NO tenant at all,
  // or if onboarding_completed is explicitly false (not null/undefined).
  // This prevents a race condition where the profile loads but tenant
  // hasn't been set yet from causing repeated onboarding redirects.
  const needsOnboarding =
    !isSuperAdmin &&
    !tenant?.id &&                          // no tenant at all
    location.pathname !== '/onboarding';

  // Also handle the case where tenant exists but onboarding not completed
  const onboardingIncomplete =
    !isSuperAdmin &&
    tenant?.id &&
    tenant?.onboarding_completed === false && // strictly false, not null/undefined
    location.pathname !== '/onboarding';

  if (needsOnboarding || onboardingIncomplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
