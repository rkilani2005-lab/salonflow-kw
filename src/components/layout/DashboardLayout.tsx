import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, Bell, Settings, LogOut } from 'lucide-react';
import { differenceInDays } from 'date-fns';

const DashboardLayout = () => {
  const { tenant, profile, userRoles, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [hasNotifications] = useState(false);

  const trialDaysLeft = tenant?.trial_ends_at
    ? differenceInDays(new Date(tenant.trial_ends_at), new Date())
    : 0;
  const showTrialWarning = tenant?.is_trial && trialDaysLeft <= 5 && trialDaysLeft > 0;

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

          {/* ── Header — 12px shorter than typical, more tool-like ── */}
          <header className="h-11 border-b border-border/60 flex items-center px-4 gap-3 bg-background sticky top-0 z-20">
            <SidebarTrigger className="h-6 w-6 text-muted-foreground/50 hover:text-foreground transition-colors flex-shrink-0" />

            {/* Date as context — tells you where you are in time */}
            <span className="text-[11px] text-muted-foreground/45 font-medium hidden md:block select-none">
              {new Date().toLocaleDateString(
                language === 'ar' ? 'ar-KW' : 'en-GB',
                { weekday: 'long', day: 'numeric', month: 'long' }
              )}
            </span>

            <div className="flex-1" />

            {/* Trial warning — only when urgent */}
            {showTrialWarning && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-sm px-2 py-0.5">
                <AlertTriangle className="h-3 w-3" />
                {trialDaysLeft}d left
              </div>
            )}

            {/* Language toggle — just text, no icon, no button shell */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="text-[11px] font-black text-muted-foreground/50 hover:text-foreground transition-colors px-1 select-none"
            >
              {language === 'en' ? 'ع' : 'EN'}
            </button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative h-6 w-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors">
                  <Bell className="h-3.5 w-3.5" />
                  {hasNotifications && (
                    <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 rounded-md">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground py-2.5 px-3">
                  {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-3 py-6 text-xs text-muted-foreground/60 text-center">
                  {language === 'ar' ? 'لا توجد إشعارات' : 'No new notifications'}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User avatar — square, brand color, confident */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center flex-shrink-0 hover:opacity-85 transition-opacity">
                  <span className="text-[10px] font-black text-primary-foreground leading-none">{initials}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-md">
                <DropdownMenuLabel className="py-2.5">
                  <p className="text-sm font-semibold">{profile?.full_name || 'User'}</p>
                  <p className="text-[11px] text-muted-foreground font-normal capitalize mt-0.5">
                    {userRoles[0] || 'user'} · {tenant?.name}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 text-xs cursor-pointer">
                  <Settings className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'الإعدادات' : 'Settings'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="gap-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/8 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* Main content */}
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
