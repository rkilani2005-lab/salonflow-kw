import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, LogOut, ExternalLink } from 'lucide-react';

const AdminLayout = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/zaina-admin/login');
  };

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-zinc-950">
        <AdminSidebar />
        <SidebarInset className="flex-1 flex flex-col bg-zinc-950">

          {/* Header */}
          <header className="h-14 border-b border-zinc-800/80 flex items-center px-4 gap-4 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-20">
            <SidebarTrigger className="text-zinc-500 hover:text-zinc-200" />
            <div className="flex-1" />

            {/* Open tenant portal */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open('/dashboard', '_blank')}
              className="h-7 gap-1.5 text-xs text-zinc-500 hover:text-zinc-200"
            >
              <ExternalLink className="h-3 w-3" />
              Tenant Portal
            </Button>

            <Badge className="gap-1 bg-red-600/20 text-red-400 border-red-600/30 border">
              <Shield className="h-3 w-3" />
              Super Admin
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-950/40"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto bg-zinc-900/20">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
