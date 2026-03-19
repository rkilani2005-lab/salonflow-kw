import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LowStockAlerts } from '@/components/dashboard/LowStockAlerts';
import { SetupChecklist } from '@/components/dashboard/SetupChecklist';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar, Users, DollarSign, TrendingUp, Clock, ArrowRight,
  UserPlus, Scissors, CheckCircle2, AlertCircle, Zap, Activity,
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const getStatusClass = (status: string) =>
  ({ completed: 'status-completed', in_service: 'status-in_service', confirmed: 'status-confirmed', planned: 'status-planned' }[status] || 'status-planned');

const getStatusLabel = (status: string, lang: string) => {
  const map: Record<string, { en: string; ar: string }> = {
    completed:  { en: 'Done',       ar: 'مكتمل' },
    in_service: { en: 'In Progress',ar: 'جارٍ' },
    confirmed:  { en: 'Confirmed',  ar: 'مؤكد' },
    planned:    { en: 'Scheduled',  ar: 'مجدول' },
  };
  return map[status]?.[lang as 'en'|'ar'] || status;
};

function useDashboardStats(tenantId?: string) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['dashboard-stats', tenantId, todayStr],
    queryFn: async () => {
      const [todayBookings, weekRev, monthRev, allClients, newClients, todayTxns] = await Promise.all([
        supabase.from('bookings').select('id,status').eq('booking_date', todayStr),
        supabase.from('transactions').select('grand_total').eq('status','completed')
          .gte('created_at', startOfWeek(today,{weekStartsOn:0}).toISOString())
          .lte('created_at', endOfWeek(today,{weekStartsOn:0}).toISOString()),
        supabase.from('transactions').select('grand_total').eq('status','completed')
          .gte('created_at', startOfMonth(today).toISOString())
          .lte('created_at', endOfMonth(today).toISOString()),
        supabase.from('clients').select('id',{count:'exact',head:true}),
        supabase.from('clients').select('id',{count:'exact',head:true})
          .gte('created_at', startOfMonth(today).toISOString())
          .lte('created_at', endOfMonth(today).toISOString()),
        supabase.from('transactions').select('grand_total').eq('status','completed')
          .gte('created_at', startOfDay(today).toISOString())
          .lte('created_at', endOfDay(today).toISOString()),
      ]);
      const appts = todayBookings.data || [];
      const sum = (arr: any[]) => arr.reduce((s,t) => s + Number(t.grand_total), 0);
      return {
        todayAppointments: appts.length,
        completedToday:    appts.filter(b => b.status === 'completed').length,
        inServiceToday:    appts.filter(b => b.status === 'in_service').length,
        pendingToday:      appts.filter(b => b.status === 'confirmed' || b.status === 'planned').length,
        todayRevenue:      sum(todayTxns.data || []),
        weeklyRevenue:     sum(weekRev.data || []),
        monthlyRevenue:    sum(monthRev.data || []),
        activeClients:     allClients.count || 0,
        newClientsThisMonth: newClients.count || 0,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });
}

function useTodayAppointments(tenantId?: string) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['today-appointments', tenantId, todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id,start_time,client_name,service_name,staff_id,status,staff:staff_id(name)')
        .eq('booking_date', todayStr)
        .order('start_time', { ascending: true })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });
}

interface KPICardProps {
  title: string; value: string | number; sub: string;
  icon: React.ComponentType<{className?:string}>; color: string;
  loading: boolean;
}
function KPICard({ title, value, sub, icon: Icon, color, loading }: KPICardProps) {
  return (
    <Card className={cn('kpi-card card-hover border overflow-hidden relative', color)}>
      <CardContent className="p-5">
        {loading ? (
          <>
            <Skeleton className="h-4 w-28 mb-3" />
            <Skeleton className="h-9 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="stat-number text-3xl font-bold tracking-tight text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { tenant, currentBranch } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const today = new Date();
  const currency = tenant?.currency || 'KWD';
  const ar = language === 'ar';

  const { data: stats, isLoading: statsLoading } = useDashboardStats(tenant?.id);
  const { data: appointments, isLoading: aptsLoading } = useTodayAppointments(tenant?.id);

  const fmt = (n: number) => n.toFixed(3);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">
            {format(today, 'EEEE, MMMM d, yyyy')}
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            {ar ? 'لوحة التحكم' : 'Dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentBranch?.name || (ar ? 'الفرع الرئيسي' : 'Main Branch')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/clients')} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            {ar ? 'عميلة جديدة' : 'New Client'}
          </Button>
          <Button size="sm" onClick={() => navigate('/calendar')} className="gap-1.5 shadow-sm">
            <Calendar className="h-3.5 w-3.5" />
            {ar ? 'حجز جديد' : 'Book Appointment'}
          </Button>
        </div>
      </div>

      {/* ── Setup Checklist (shown until all 4 requirements met) ── */}
      <SetupChecklist />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={ar ? 'مواعيد اليوم' : "Today's Appointments"}
          value={stats?.todayAppointments ?? 0}
          sub={`${stats?.completedToday ?? 0} ${ar ? 'مكتمل' : 'done'} · ${stats?.pendingToday ?? 0} ${ar ? 'قيد الانتظار' : 'pending'}`}
          icon={Calendar} color="" loading={statsLoading}
        />
        <KPICard
          title={ar ? 'إيرادات اليوم' : "Today's Revenue"}
          value={`${fmt(stats?.todayRevenue ?? 0)} ${currency}`}
          sub={ar ? 'من المعاملات المكتملة' : 'From completed transactions'}
          icon={DollarSign} color="" loading={statsLoading}
        />
        <KPICard
          title={ar ? 'إيرادات الأسبوع' : 'Weekly Revenue'}
          value={`${fmt(stats?.weeklyRevenue ?? 0)} ${currency}`}
          sub={ar ? 'هذا الأسبوع' : 'This week'}
          icon={TrendingUp} color="" loading={statsLoading}
        />
        <KPICard
          title={ar ? 'العميلات' : 'Active Clients'}
          value={stats?.activeClients ?? 0}
          sub={`+${stats?.newClientsThisMonth ?? 0} ${ar ? 'هذا الشهر' : 'this month'}`}
          icon={Users} color="" loading={statsLoading}
        />
      </div>

      {/* ── Low Stock Alerts ── */}
      <LowStockAlerts />

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Today's Schedule */}
        <Card className="lg:col-span-2 border">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <div>
              <CardTitle className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
                {ar ? 'جدول اليوم' : "Today's Schedule"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {ar ? 'مواعيد اليوم' : 'Appointments booked for today'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')} className="h-8 text-xs gap-1 text-primary">
              {ar ? 'عرض الكل' : 'View All'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {aptsLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : appointments && appointments.length > 0 ? (
              <div className="divide-y divide-border/50">
                {appointments.map((apt: any) => (
                  <div key={apt.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[44px]">
                        <p className="text-xs font-bold text-primary">{apt.start_time?.slice(0,5)}</p>
                      </div>
                      <div className="h-7 w-[1px] bg-border/60" />
                      <div>
                        <p className="text-sm font-medium leading-tight">{apt.client_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {apt.service_name} · {(apt.staff as any)?.name || '—'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold border', getStatusClass(apt.status))}>
                      {getStatusLabel(apt.status, language)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {ar ? 'لا توجد مواعيد اليوم' : 'No appointments today'}
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate('/calendar')} className="mt-3 text-xs h-7">
                  {ar ? 'إضافة موعد' : 'Add appointment'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-4">

          {/* Quick Actions */}
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
                {ar ? 'إجراءات سريعة' : 'Quick Actions'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-0">
              {[
                { icon: Calendar,  label: ar ? 'حجز جديد' : 'New Booking',  to: '/calendar' },
                { icon: UserPlus,  label: ar ? 'عميلة جديدة' : 'Add Client', to: '/clients' },
                { icon: Scissors,  label: ar ? 'الخدمات' : 'Services',       to: '/services' },
                { icon: TrendingUp,label: ar ? 'التقارير' : 'Reports',        to: '/reports' },
              ].map(({ icon: Icon, label, to }) => (
                <Button
                  key={to}
                  variant="outline"
                  onClick={() => navigate(to)}
                  className="h-auto py-3.5 flex-col gap-1.5 text-xs hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Today's Summary */}
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
                {ar ? 'ملخص اليوم' : "Today's Summary"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {statsLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                [
                  { icon: CheckCircle2, label: ar ? 'مكتمل' : 'Completed',   val: stats?.completedToday  ?? 0, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  { icon: Activity,     label: ar ? 'جارٍ' : 'In Progress',   val: stats?.inServiceToday  ?? 0, color: 'text-blue-500',    bg: 'bg-blue-500/10' },
                  { icon: AlertCircle,  label: ar ? 'قيد الانتظار' : 'Pending', val: stats?.pendingToday  ?? 0, color: 'text-amber-500',   bg: 'bg-amber-500/10' },
                ].map(({ icon: Icon, label, val, color, bg }) => (
                  <div key={label} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('h-7 w-7 rounded-md flex items-center justify-center', bg)}>
                        <Icon className={cn('h-3.5 w-3.5', color)} />
                      </div>
                      <span className="text-sm">{label}</span>
                    </div>
                    <span className="text-sm font-bold">{val}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Monthly Revenue */}
          <Card className="border bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="p-5">
              {statsLoading ? (
                <><Skeleton className="h-5 w-28 mb-3" /><Skeleton className="h-10 w-36" /></>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
                      {ar ? 'إيرادات الشهر' : 'Monthly Revenue'}
                    </p>
                  </div>
                  <p className="stat-number text-2xl font-bold">
                    {fmt(stats?.monthlyRevenue ?? 0)}
                    <span className="text-base font-normal text-muted-foreground ml-1">{currency}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ar ? 'الشهر الحالي' : 'Current month total'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
