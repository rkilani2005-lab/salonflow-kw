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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check for super_admin role
  const isSuperAdmin = userRoles.includes('super_admin' as any);
  
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default SuperAdminRoute;
