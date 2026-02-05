 import { Outlet } from 'react-router-dom';
 import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
 import AppSidebar from './AppSidebar';
 import { useAuth } from '@/contexts/AuthContext';
 import { Badge } from '@/components/ui/badge';
 import { AlertTriangle } from 'lucide-react';
 import { differenceInDays } from 'date-fns';
 
 const DashboardLayout = () => {
   const { tenant } = useAuth();
   
   const trialDaysLeft = tenant?.trial_ends_at 
     ? differenceInDays(new Date(tenant.trial_ends_at), new Date())
     : 0;
 
   const showTrialWarning = tenant?.is_trial && trialDaysLeft <= 3 && trialDaysLeft > 0;
 
   return (
     <SidebarProvider defaultOpen>
       <div className="min-h-screen flex w-full">
         <AppSidebar />
         <SidebarInset className="flex-1 flex flex-col">
           {/* Header */}
           <header className="h-14 border-b flex items-center px-4 gap-4 bg-background sticky top-0 z-10">
             <SidebarTrigger />
             
             <div className="flex-1" />
             
             {showTrialWarning && (
               <Badge variant="destructive" className="gap-1">
                 <AlertTriangle className="h-3 w-3" />
                 Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}
               </Badge>
             )}
           </header>
           
           {/* Main Content */}
           <main className="flex-1 overflow-auto">
             <Outlet />
           </main>
         </SidebarInset>
       </div>
     </SidebarProvider>
   );
 };
 
 export default DashboardLayout;