 import { useLocation, useNavigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 import { NavLink } from '@/components/NavLink';
 import BranchSwitcher from './BranchSwitcher';
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
    Calendar,
    Users,
    Scissors,
    Package,
    CreditCard,
    BarChart3,
    Settings,
    LogOut,
    Sparkles,
    Crown,
    UserCog,
    Bot,
  } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { differenceInDays } from 'date-fns';
 
 type NavItem = {
   title: string;
   url: string;
   icon: React.ComponentType<{ className?: string }>;
   roles?: string[];
 };
 
const mainNavItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Clients', url: '/clients', icon: Users, roles: ['owner', 'manager', 'receptionist'] },
  { title: 'Staff', url: '/staff', icon: UserCog, roles: ['owner', 'manager'] },
  { title: 'Services', url: '/services', icon: Scissors, roles: ['owner', 'manager'] },
];
 
  const businessNavItems: NavItem[] = [
    { title: 'POS', url: '/pos', icon: CreditCard, roles: ['owner', 'manager', 'receptionist', 'cashier'] },
    { title: 'Inventory', url: '/inventory', icon: Package, roles: ['owner', 'manager', 'inventory_clerk'] },
    { title: 'Reports', url: '/reports', icon: BarChart3, roles: ['owner', 'manager', 'accountant'] },
    { title: 'WhatsApp AI', url: '/whatsapp-agent', icon: Bot, roles: ['owner', 'manager'] },
  ];
 
 const AppSidebar = () => {
   const { state } = useSidebar();
   const collapsed = state === 'collapsed';
   const location = useLocation();
   const navigate = useNavigate();
   const { tenant, profile, userRoles, signOut, hasRole } = useAuth();
 
   const trialDaysLeft = tenant?.trial_ends_at 
     ? differenceInDays(new Date(tenant.trial_ends_at), new Date())
     : 0;
 
   const canAccess = (item: NavItem) => {
     if (!item.roles) return true;
     return item.roles.some(role => hasRole(role as any));
   };
 
   const handleSignOut = async () => {
     await signOut();
     navigate('/auth');
   };
 
   return (
     <Sidebar collapsible="icon" className="border-r">
       <SidebarHeader className="p-4">
         <div className="flex items-center gap-3">
           {tenant?.logo_url ? (
             <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-8 rounded-lg object-cover" />
           ) : (
             <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
               <Scissors className="h-4 w-4 text-primary-foreground" />
             </div>
           )}
           {!collapsed && (
             <div className="flex flex-col">
               <span className="font-semibold text-sm truncate max-w-[140px]">{tenant?.name}</span>
               {tenant?.is_trial && trialDaysLeft > 0 && (
                 <Badge variant="secondary" className="text-xs w-fit">
                   <Sparkles className="h-3 w-3 mr-1" />
                   {trialDaysLeft}d trial left
                 </Badge>
               )}
             </div>
           )}
         </div>
       </SidebarHeader>
 
       {!collapsed && (
         <>
           <SidebarSeparator />
           <div className="px-2 py-2">
             <BranchSwitcher />
           </div>
         </>
       )}
 
       <SidebarSeparator />
 
       <SidebarContent>
         <SidebarGroup>
           <SidebarGroupLabel>Main</SidebarGroupLabel>
           <SidebarGroupContent>
             <SidebarMenu>
               {mainNavItems.filter(canAccess).map((item) => (
                 <SidebarMenuItem key={item.title}>
                   <SidebarMenuButton asChild tooltip={item.title}>
                     <NavLink 
                       to={item.url} 
                       className="flex items-center gap-3 hover:bg-accent rounded-md px-3 py-2"
                       activeClassName="bg-accent text-accent-foreground font-medium"
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
           <SidebarGroupLabel>Business</SidebarGroupLabel>
           <SidebarGroupContent>
             <SidebarMenu>
               {businessNavItems.filter(canAccess).map((item) => (
                 <SidebarMenuItem key={item.title}>
                   <SidebarMenuButton asChild tooltip={item.title}>
                     <NavLink 
                       to={item.url} 
                       className="flex items-center gap-3 hover:bg-accent rounded-md px-3 py-2"
                       activeClassName="bg-accent text-accent-foreground font-medium"
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
           <SidebarGroupLabel>Settings</SidebarGroupLabel>
           <SidebarGroupContent>
             <SidebarMenu>
               <SidebarMenuItem>
                 <SidebarMenuButton asChild tooltip="Settings">
                   <NavLink 
                     to="/settings" 
                     className="flex items-center gap-3 hover:bg-accent rounded-md px-3 py-2"
                     activeClassName="bg-accent text-accent-foreground font-medium"
                   >
                     <Settings className="h-4 w-4" />
                     {!collapsed && <span>Settings</span>}
                   </NavLink>
                 </SidebarMenuButton>
               </SidebarMenuItem>
               {hasRole('owner') && (
                 <SidebarMenuItem>
                   <SidebarMenuButton asChild tooltip="Subscription">
                     <NavLink 
                       to="/subscription" 
                       className="flex items-center gap-3 hover:bg-accent rounded-md px-3 py-2"
                       activeClassName="bg-accent text-accent-foreground font-medium"
                     >
                       <Crown className="h-4 w-4" />
                       {!collapsed && <span>Subscription</span>}
                     </NavLink>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
               )}
             </SidebarMenu>
           </SidebarGroupContent>
         </SidebarGroup>
       </SidebarContent>
 
       <SidebarFooter className="p-4">
         <SidebarSeparator className="mb-4" />
         <div className="flex items-center gap-3">
           <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
             <span className="text-sm font-medium">
               {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
             </span>
           </div>
           {!collapsed && (
             <div className="flex-1 min-w-0">
               <p className="text-sm font-medium truncate">{profile?.full_name}</p>
               <p className="text-xs text-muted-foreground capitalize">
                 {userRoles[0] || 'User'}
               </p>
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
 
 export default AppSidebar;