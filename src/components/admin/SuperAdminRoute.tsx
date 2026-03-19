import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

const SuperAdminRoute = ({ children }: SuperAdminRouteProps) => {
  const { user, userRoles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
      </div>
    );
  }

  // Not logged in → dedicated admin login page
  if (!user) {
    return <Navigate to="/zaina-admin/login" state={{ from: location }} replace />;
  }

  // Logged in but not a super_admin → back to admin login (not tenant auth)
  const isSuperAdmin = userRoles.includes('super_admin' as any);
  if (!isSuperAdmin) {
    return <Navigate to="/zaina-admin/login" replace />;
  }

  return <>{children}</>;
};

export default SuperAdminRoute;
