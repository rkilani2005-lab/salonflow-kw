 import { Navigate, useLocation } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 
 interface ProtectedRouteProps {
   children: React.ReactNode;
 }
 
 const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
   const { user, tenant, loading } = useAuth();
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
 
   // Logged in but no tenant (hasn't completed onboarding)
   if (!tenant?.onboarding_completed && location.pathname !== '/onboarding') {
     return <Navigate to="/onboarding" replace />;
   }
 
   return <>{children}</>;
 };
 
 export default ProtectedRoute;