import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';

const AdminLayout = () => {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center px-4 gap-4 bg-background sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex-1" />
            <Badge variant="destructive" className="gap-1">
              <Shield className="h-3 w-3" />
              Super Admin Mode
            </Badge>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
