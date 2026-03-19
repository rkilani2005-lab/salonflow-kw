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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
            >
              <Languages className="h-3.5 w-3.5" />
              {language === 'en' ? 'عربي' : 'EN'}
            </Button>

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
