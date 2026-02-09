import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  BarChart3,
  Users,
  LogOut,
  Shield,
  Settings,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/NavLink';

const navItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Tenants', url: '/admin/tenants', icon: Building2 },
  { title: 'Subscriptions', url: '/admin/subscriptions', icon: CreditCard },
  { title: 'Analytics', url: '/admin/analytics', icon: BarChart3 },
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'WhatsApp AI', url: '/whatsapp-agent', icon: Bot },
];

const AdminSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-destructive flex items-center justify-center">
            <Shield className="h-4 w-4 text-destructive-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Super Admin</span>
              <span className="text-xs text-muted-foreground">Platform Control</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 hover:bg-accent rounded-md px-3 py-2"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                      end={item.url === '/admin'}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings">
                  <NavLink
                    to="/admin/settings"
                    className="flex items-center gap-3 hover:bg-accent rounded-md px-3 py-2"
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    <Settings className="h-4 w-4" />
                    {!collapsed && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarSeparator className="mb-4" />
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center">
            <Shield className="h-4 w-4 text-destructive" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-destructive">Super Admin</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-8 w-8"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
