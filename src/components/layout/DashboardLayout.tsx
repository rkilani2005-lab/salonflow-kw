import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, Bell, Settings, LogOut, User, Languages } from 'lucide-react';
import { differenceInDays } from 'date-fns';

const DashboardLayout = () => {
  const { tenant, profile, userRoles, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [hasNotifications] = useState(true); // will wire to real data in Phase 2

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
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          {/* ── Header ── */}
          <header className="h-14 border-b flex items-center px-4 gap-3 bg-background sticky top-0 z-10">
            <SidebarTrigger />

            <div className="flex-1" />

            {/* Trial warning */}
            {showTrialWarning && (
              <Badge variant="destructive" className="gap-1 hidden sm:flex">
                <AlertTriangle className="h-3 w-3" />
                Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}
              </Badge>
            )}

            {/* Language toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs font-medium"
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              title="Toggle language"
            >
              <Languages className="h-4 w-4" />
              {language === 'en' ? 'AR' : 'EN'}
            </Button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  {hasNotifications && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No new notifications
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User avatar + menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary">{initials}</span>
                  </div>
                  <span className="hidden sm:inline text-sm max-w-[120px] truncate">
                    {profile?.full_name || 'User'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{profile?.full_name || 'User'}</span>
                    <span className="text-xs text-muted-foreground font-normal capitalize">
                      {userRoles[0] || 'User'} — {tenant?.name}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="h-4 w-4 mr-2" />Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
