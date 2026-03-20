import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, Bell, Settings, LogOut, Languages } from 'lucide-react';
import { differenceInDays } from 'date-fns';

const DashboardLayout = () => {
  const { tenant, profile, userRoles, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [hasNotifications] = useState(false);

  const trialDaysLeft = tenant?.trial_ends_at
    ? differenceInDays(new Date(tenant.trial_ends_at), new Date())
    : 0;
  const showTrialWarning = tenant?.is_trial && trialDaysLeft <= 3 && trialDaysLeft > 0;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0">

          {/* ── Top Header ── */}
          <header className="h-14 border-b border-border/60 flex items-center px-4 gap-3 bg-background/95 backdrop-blur-sm sticky top-0 z-20">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />

            <div className="flex-1" />

            {showTrialWarning && (
              <Badge variant="destructive" className="gap-1 text-xs hidden sm:flex">
                <AlertTriangle className="h-3 w-3" />
                Trial ends in {trialDaysLeft}d
              </Badge>
            )}

            {/* Language toggle */}
          {/* ── Top Header — minimal, unobtrusive ── */}
          <header className="h-12 border-b border-border/50 flex items-center px-4 gap-3 bg-background/98 backdrop-blur-sm sticky top-0 z-20">
            <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors" />

            {/* Page context — show current date as context anchor */}
            <div className="flex-1 hidden sm:flex items-center">
              <span className="text-[11px] text-muted-foreground/60 font-medium tracking-wide">
                {new Date().toLocaleDateString(language === 'ar' ? 'ar-KW' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <div className="flex-1 sm:hidden" />

            {showTrialWarning && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1">
                <AlertTriangle className="h-3 w-3" />
                Trial ends in {trialDaysLeft}d
              </div>
            )}

            {/* Language toggle — minimal text swap */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded"
            >
              {language === 'en' ? 'عربي' : 'EN'}
            </button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 relative flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted">
                  <Bell className="h-[15px] w-[15px]" />
                  {hasNotifications && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs font-semibold">
                  {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-3 py-5 text-xs text-muted-foreground text-center">
                  {language === 'ar' ? 'لا توجد إشعارات جديدة' : 'No new notifications'}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User — square avatar, no full name in header */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 rounded-sm bg-primary flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity">
                  <span className="text-[11px] font-bold text-primary-foreground">{initials}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{profile?.full_name || 'User'}</p>
                  <p className="text-[11px] text-muted-foreground font-normal capitalize mt-0.5">
                    {userRoles[0] || 'user'} · {tenant?.name}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 text-sm">
                  <Settings className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'الإعدادات' : 'Settings'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="gap-2 text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="page-enter">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 relative text-muted-foreground hover:text-foreground">
                  <Bell className="h-4 w-4" />
                  {hasNotifications && (
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="font-semibold">
                  {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                  {language === 'ar' ? 'لا توجد إشعارات جديدة' : 'No new notifications'}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-muted-foreground hover:text-foreground">
                  <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary">{initials}</span>
                  </div>
                  <span className="hidden sm:inline text-xs font-medium max-w-[100px] truncate">
                    {profile?.full_name || 'User'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <p className="font-semibold text-sm">{profile?.full_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground font-normal capitalize mt-0.5">
                    {userRoles[0] || 'User'} · {tenant?.name}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 text-sm">
                  <Settings className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'الإعدادات' : 'Settings'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="gap-2 text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="page-enter">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
