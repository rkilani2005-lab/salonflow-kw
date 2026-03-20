import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import BranchSwitcher from './BranchSwitcher';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator, useSidebar,
} from '@/components/ui/sidebar';
import {
  Calendar, Users, Scissors, Package, CreditCard, BarChart3,
  Settings, LogOut, Sparkles, Crown, UserCog, Bot, LayoutDashboard,
  Brain, CalendarClock, HeartHandshake, PackageSearch, Landmark, Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { differenceInDays } from 'date-fns';

type NavItem = {
  title: string;
  titleAr: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

const mainNavItems: NavItem[] = [
  { title: 'Dashboard',  titleAr: 'الرئيسية',   url: '/dashboard', icon: LayoutDashboard },
  { title: 'Calendar',   titleAr: 'التقويم',     url: '/calendar',  icon: Calendar },
  { title: 'Clients',    titleAr: 'العميلات',    url: '/clients',   icon: Users,    roles: ['owner','manager','receptionist'] },
  { title: 'Staff',      titleAr: 'الموظفات',   url: '/staff',     icon: UserCog,  roles: ['owner','manager'] },
  { title: 'Services',   titleAr: 'الخدمات',    url: '/services',  icon: Scissors, roles: ['owner','manager'] },
];

const businessNavItems: NavItem[] = [
  { title: 'POS',          titleAr: 'نقطة البيع',    url: '/pos',           icon: CreditCard,  roles: ['owner','manager','receptionist','cashier'] },
  { title: 'Day Session',  titleAr: 'جلسة اليوم',    url: '/day-session',   icon: Calculator,  roles: ['owner','manager','receptionist','cashier'] },
  { title: 'Inventory',    titleAr: 'المخزون',       url: '/inventory',     icon: Package,     roles: ['owner','manager','inventory_clerk'] },
  { title: 'Finance',      titleAr: 'المحاسبة',      url: '/finance',       icon: Landmark,    roles: ['owner','manager','accountant'] },
  { title: 'Reports',      titleAr: 'التقارير',      url: '/reports',       icon: BarChart3,   roles: ['owner','manager','accountant'] },
  { title: 'WhatsApp AI',  titleAr: 'واتساب AI',     url: '/whatsapp-agent', icon: Bot,        roles: ['owner','manager'] },
];

const aiNavItems: NavItem[] = [
  { title: 'Smart Schedule', titleAr: 'الجدولة الذكية',    url: '/ai/scheduling', icon: CalendarClock,    roles: ['owner','manager'] },
  { title: 'Client Intel',   titleAr: 'ذكاء العميلات',    url: '/ai/clients',    icon: HeartHandshake,   roles: ['owner','manager'] },
  { title: 'AI Inventory',   titleAr: 'مخزون ذكي',        url: '/ai/inventory',  icon: PackageSearch,    roles: ['owner','manager','inventory_clerk'] },
];

const AppSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, profile, userRoles, signOut, hasRole } = useAuth();
  const { language } = useLanguage();

  const trialDaysLeft = tenant?.trial_ends_at
    ? differenceInDays(new Date(tenant.trial_ends_at), new Date())
    : 0;

  const canAccess = (item: NavItem) => {
    if (!item.roles) return true;
    return item.roles.some(role => hasRole(role as any));
  };

  const isActive = (url: string) => location.pathname === url;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const label = (item: NavItem) => language === 'ar' ? item.titleAr : item.title;

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* ── Brand ── */}
      <SidebarHeader className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          {/* Logomark: Z with a fine rule underneath — editorial not bubbly */}
          <div className="flex-shrink-0 relative">
            <div
              className="h-7 w-7 bg-primary flex items-center justify-center"
              style={{ borderRadius: '3px' }}
            >
              <span
                className="text-primary-foreground font-black leading-none select-none"
                style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', letterSpacing: '-0.05em' }}
              >
                Z
              </span>
            </div>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span
                className="font-bold text-[13px] text-sidebar-foreground leading-tight"
                style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em' }}
              >
                {tenant?.name || 'ZAINA'}
              </span>
              <span className="text-[10px] text-sidebar-foreground/30 leading-tight mt-px">
                {tenant?.is_trial && trialDaysLeft > 0
                  ? `trial · ${trialDaysLeft}d`
                  : userRoles[0] || 'workspace'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Branch switcher */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <BranchSwitcher />
        </div>
      )}

      {/* Thin separator */}
      <div className="mx-3 h-px bg-sidebar-border mb-3" />

      <SidebarContent className="px-2 gap-0">

        {/* ── Salon section ── */}
        {!collapsed && (
          <div className="section-label px-2 mb-1.5" style={{ color: 'hsl(var(--sidebar-foreground) / 0.35)' }}>
            <div style={{ background: 'hsl(var(--sidebar-primary))', width: 18, height: 2, borderRadius: 99, flexShrink: 0 }} />
            {language === 'ar' ? 'الصالون' : 'Salon'}
          </div>
        )}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {mainNavItems.filter(canAccess).map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)}>
                    <button
                      onClick={() => navigate(item.url)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-100 relative',
                        isActive(item.url)
                          ? 'nav-active'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-[15px] w-[15px] flex-shrink-0" />
                      {!collapsed && <span>{label(item)}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-2 h-px bg-sidebar-border my-3" />

        {/* ── Operations section ── */}
        {!collapsed && (
          <div className="section-label px-2 mb-1.5" style={{ color: 'hsl(var(--sidebar-foreground) / 0.35)' }}>
            <div style={{ background: 'hsl(var(--sidebar-primary))', width: 18, height: 2, borderRadius: 99, flexShrink: 0 }} />
            {language === 'ar' ? 'التشغيل' : 'Operations'}
          </div>
        )}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {businessNavItems.filter(canAccess).map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)}>
                    <button
                      onClick={() => navigate(item.url)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-100 relative',
                        isActive(item.url)
                          ? 'nav-active'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-[15px] w-[15px] flex-shrink-0" />
                      {!collapsed && <span>{label(item)}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-2 h-px bg-sidebar-border my-3" />

        {/* ── AI section — subtle gold accent ── */}
        {!collapsed && (
          <div className="section-label px-2 mb-1.5" style={{ color: 'hsl(var(--sidebar-foreground) / 0.35)' }}>
            <div style={{ background: 'hsl(var(--accent))', width: 18, height: 2, borderRadius: 99, flexShrink: 0 }} />
            {language === 'ar' ? 'الذكاء الاصطناعي' : 'Intelligence'}
          </div>
        )}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {aiNavItems.filter(canAccess).map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)}>
                    <button
                      onClick={() => navigate(item.url)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-100 relative',
                        isActive(item.url)
                          ? 'nav-active'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-[15px] w-[15px] flex-shrink-0" />
                      {!collapsed && <span>{label(item)}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings + Subscription at bottom of content area */}
        <div className="mx-2 h-px bg-sidebar-border my-3" />
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {[
                { url: '/settings', icon: Settings, en: 'Settings', ar: 'الإعدادات' },
                ...(hasRole('owner') ? [{ url: '/subscription', icon: Crown, en: 'Subscription', ar: 'الاشتراك' }] : []),
              ].map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.en} isActive={isActive(item.url)}>
                    <button
                      onClick={() => navigate(item.url)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-100 relative',
                        isActive(item.url)
                          ? 'nav-active'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-[15px] w-[15px] flex-shrink-0" />
                      {!collapsed && <span>{language === 'ar' ? item.ar : item.en}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      {/* ── User footer — editorial strip ── */}
      <SidebarFooter className="p-0">
        <div className="mx-3 h-px bg-sidebar-border mb-0" />
        <div className={cn(
          'flex items-center gap-2.5 px-3 py-3.5',
          collapsed && 'justify-center'
        )}>
          {/* Avatar — sharp square, not circle */}
          <div className="h-7 w-7 rounded-sm bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-primary-foreground">{initials}</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-sidebar-foreground leading-tight truncate">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-[10px] text-sidebar-foreground/40 capitalize">
                  {userRoles[0] || 'user'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-6 w-6 text-sidebar-foreground/40 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Scissors className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-wide text-sidebar-foreground" style={{ fontFamily: 'Syne, sans-serif' }}>
                {tenant?.name || 'ZAINA'}
              </span>
              {tenant?.is_trial && trialDaysLeft > 0 && (
                <span className="text-[10px] text-primary/80 font-medium">
                  <Sparkles className="h-2.5 w-2.5 inline mr-0.5" />
                  {trialDaysLeft}d trial
                </span>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Branch switcher */}
      {!collapsed && (
        <>
          <SidebarSeparator className="bg-sidebar-border" />
          <div className="px-3 py-2">
            <BranchSwitcher />
          </div>
        </>
      )}

      <SidebarSeparator className="bg-sidebar-border" />

      <SidebarContent className="px-2">
        {/* Main nav */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/40 px-2 mb-1">
              {language === 'ar' ? 'القائمة الرئيسية' : 'Main'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {mainNavItems.filter(canAccess).map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActive(item.url)}
                  >
                    <button
                      onClick={() => navigate(item.url)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                        isActive(item.url)
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive(item.url) && 'text-primary')} />
                      {!collapsed && <span>{label(item)}</span>}
                      {isActive(item.url) && !collapsed && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Business nav */}
        <SidebarGroup className="mt-2">
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/40 px-2 mb-1">
              {language === 'ar' ? 'الأعمال' : 'Business'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {businessNavItems.filter(canAccess).map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActive(item.url)}
                  >
                    <button
                      onClick={() => navigate(item.url)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                        isActive(item.url)
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive(item.url) && 'text-primary')} />
                      {!collapsed && <span>{label(item)}</span>}
                      {isActive(item.url) && !collapsed && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* AI Features */}
        <SidebarGroup className="mt-2">
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/40 px-2 mb-1">
              <span className="mr-1">✦</span>
              {language === 'ar' ? 'الذكاء الاصطناعي' : 'AI Features'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {aiNavItems.filter(canAccess).map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)}>
                    <button
                      onClick={() => navigate(item.url)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                        isActive(item.url)
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive(item.url) && 'text-primary')} />
                      {!collapsed && <span>{label(item)}</span>}
                      {isActive(item.url) && !collapsed && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup className="mt-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings" isActive={isActive('/settings')}>
                  <button
                    onClick={() => navigate('/settings')}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                      isActive('/settings')
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Settings className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {hasRole('owner') && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Subscription" isActive={isActive('/subscription')}>
                    <button
                      onClick={() => navigate('/subscription')}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                        isActive('/subscription')
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <Crown className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span>{language === 'ar' ? 'الاشتراك' : 'Subscription'}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer / User ── */}
      <SidebarFooter className="p-3">
        <SidebarSeparator className="bg-sidebar-border mb-3" />
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">{initials}</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{profile?.full_name || 'User'}</p>
                <p className="text-[10px] text-sidebar-foreground/50 capitalize">{userRoles[0] || 'User'}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-7 w-7 text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10"
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

export default AppSidebar;
