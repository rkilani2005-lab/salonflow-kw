import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowSuperAdmin?: boolean;
}

const ProtectedRoute = ({ children, allowSuperAdmin = false }: ProtectedRouteProps) => {
  const { user, tenant, userRoles, loading } = useAuth();
  const location = useLocation();

  // While AuthContext is fetching profile/tenant, show a spinner.
  // AuthContext sets loading=true synchronously when a session is detected
  // so this spinner always shows before any redirect decision is made.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // No session → tenant login page
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const isSuperAdmin = userRoles.includes('super_admin' as any);

  // Super admins belong in the admin portal, not the tenant dashboard
  if (isSuperAdmin && !allowSuperAdmin) {
    return <Navigate to="/zaina-admin" replace />;
  }

  // Onboarding gate for regular tenant users.
  //
  // Two distinct cases:
  //   A) needsOnboarding  — profile exists but has no tenant_id at all
  //                         (brand new user who hasn't run the wizard yet)
  //   B) onboardingIncomplete — tenant exists but onboarding_completed is
  //                             STRICTLY false (not null, not undefined)
  //
  // IMPORTANT: null/undefined for onboarding_completed must NOT trigger
  // a redirect — this avoids a race where the tenant row is fetched but
  // the column hasn't been written yet (returns null briefly).
  const needsOnboarding =
    !isSuperAdmin &&
    !tenant?.id &&
    location.pathname !== '/onboarding';

  const onboardingIncomplete =
    !isSuperAdmin &&
    !!tenant?.id &&
    tenant.onboarding_completed === false &&   // strictly false only
    location.pathname !== '/onboarding';

  if (needsOnboarding || onboardingIncomplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
