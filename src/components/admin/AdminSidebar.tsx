import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator, useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Building2, CreditCard, BarChart3,
  Users, LogOut, Shield, Bot, DollarSign, BookOpen,
  Receipt, Landmark, Calculator, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Nav sections ──────────────────────────────────────────────
const PLATFORM_NAV = [
  { title: 'Dashboard',     url: '/zaina-admin',               icon: LayoutDashboard },
  { title: 'Tenants',       url: '/zaina-admin/tenants',       icon: Building2 },
  { title: 'Subscriptions', url: '/zaina-admin/subscriptions', icon: CreditCard },
  { title: 'Analytics',     url: '/zaina-admin/analytics',     icon: BarChart3 },
  { title: 'Users',         url: '/zaina-admin/users',         icon: Users },
  { title: 'WhatsApp AI',   url: '/whatsapp-agent',            icon: Bot },
];

const FINANCE_NAV = [
  { title: 'Finance Overview', url: '/zaina-admin/finance',   icon: DollarSign },
  { title: 'Chart of Accounts',url: '/zaina-admin/accounts',  icon: Calculator },
];

const AdminSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const isActive = (url: string) =>
    url === '/zaina-admin'
      ? location.pathname === '/zaina-admin'
      : location.pathname.startsWith(url);

  const handleSignOut = async () => {
    await signOut();
    navigate('/zaina-admin/login');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'SA';

  const NavItem = ({ item }: { item: typeof PLATFORM_NAV[0] }) => (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)}>
        <button
          onClick={() => navigate(item.url)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
            isActive(item.url)
              ? 'bg-red-600/15 text-red-400 font-medium'
              : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
          )}
        >
          <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive(item.url) && 'text-red-400')} />
          {!collapsed && <span>{item.title}</span>}
          {isActive(item.url) && !collapsed && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500" />
          )}
        </button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-zinc-950">
      {/* ── Header ── */}
      <SidebarHeader className="px-4 py-5 bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-zinc-100" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                ZAINA Admin
              </span>
              <span className="text-[10px] text-zinc-500">Platform Control</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator className="bg-zinc-800" />

      <SidebarContent className="px-2 bg-zinc-950">

        {/* ── Platform section ── */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-zinc-600 px-2 mb-1">
              Platform
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {PLATFORM_NAV.map(item => <NavItem key={item.url} item={item} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Finance & Accounts section ── */}
        <SidebarGroup className="mt-3">
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-zinc-600 px-2 mb-1">
              <span className="mr-1 text-amber-500">$</span> Finance & Accounts
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {FINANCE_NAV.map(item => <NavItem key={item.url} item={item} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="p-3 bg-zinc-950">
        <SidebarSeparator className="bg-zinc-800 mb-3" />
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="h-8 w-8 rounded-full bg-red-900/40 border border-red-800/40 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-red-400">{initials}</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-300 truncate">{profile?.full_name || 'Super Admin'}</p>
                <p className="text-[10px] text-zinc-600">super_admin</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-7 w-7 text-zinc-600 hover:text-red-400 hover:bg-red-950/40"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
