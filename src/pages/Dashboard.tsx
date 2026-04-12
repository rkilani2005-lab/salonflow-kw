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
  loading: boolean; onClick?: () => void;
}
function KPICard({ title, value, sub, loading, onClick }: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'kpi-card bg-card border rounded-md p-5',
        onClick && 'card-interactive'
      )}
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/60 select-none">
            {title}
          </p>
          <p className="stat-number text-[2rem] leading-none tracking-tight text-foreground">
            {value}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">{sub}</p>
        </div>
      )}
    </div>
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
    <div className="p-5 space-y-5 max-w-7xl mx-auto">

      {/* ── Header — less chrome, more content ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {format(today, 'EEEE, MMMM d')}
          </p>
          <h1 className="text-3xl leading-none font-black" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.04em' }}>
            {currentBranch?.name || (ar ? 'لوحة التحكم' : 'Dashboard')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/clients')}
            className="h-8 text-xs gap-1.5 hidden sm:flex">
            <UserPlus className="h-3.5 w-3.5" />
            {ar ? 'عميلة' : 'Client'}
          </Button>
          <Button size="sm" onClick={() => navigate('/calendar')}
            className="h-8 text-xs gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {ar ? 'حجز' : 'Book'}
          </Button>
        </div>
      </div>

      {/* ── Setup Checklist ── */}
      <SetupChecklist />

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title={ar ? 'مواعيد اليوم' : "Today"}
          value={stats?.todayAppointments ?? 0}
          sub={`${stats?.completedToday ?? 0} ${ar ? 'مكتمل' : 'done'} · ${stats?.pendingToday ?? 0} ${ar ? 'معلق' : 'pending'}`}
          icon={Calendar} color="" loading={statsLoading}
        />
        <KPICard
          title={ar ? 'إيرادات اليوم' : "Revenue today"}
          value={`${fmt(stats?.todayRevenue ?? 0)}`}
          sub={currency}
          icon={DollarSign} color="" loading={statsLoading}
        />
        <KPICard
          title={ar ? 'إيرادات الأسبوع' : "This week"}
          value={`${fmt(stats?.weeklyRevenue ?? 0)}`}
          sub={currency}
          icon={TrendingUp} color="" loading={statsLoading}
        />
        <KPICard
          title={ar ? 'العميلات' : "Clients"}
          value={stats?.activeClients ?? 0}
          sub={`+${stats?.newClientsThisMonth ?? 0} ${ar ? 'هذا الشهر' : 'this month'}`}
          icon={Users} color="" loading={statsLoading}
        />
      </div>

      {/* ── Low Stock Alerts ── */}
      <LowStockAlerts />

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Today's Schedule — 2/3 width, list style */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
            <div>
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                {ar ? 'جدول اليوم' : "Today's Schedule"}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {format(today, 'EEEE, MMMM d')}
              </p>
            </div>
            <button
              onClick={() => navigate('/calendar')}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
            >
              {ar ? 'الكل' : 'View all'}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {aptsLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : appointments && appointments.length > 0 ? (
            <div>
              {appointments.map((apt: any) => (
                <div key={apt.id} className="data-row gap-4">
                  {/* Time — tight, monospaced feel */}
                  <div className="w-10 flex-shrink-0 text-center">
                    <p className="text-xs font-bold tabular-nums text-primary">
                      {apt.start_time?.slice(0, 5)}
                    </p>
                  </div>

                  {/* Vertical rule */}
                  <div className="w-px h-8 bg-border/60 flex-shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{apt.client_name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {apt.service_name}
                      {(apt.staff as any)?.name && <span className="text-muted-foreground/60"> · {(apt.staff as any).name}</span>}
                    </p>
                  </div>

                  {/* Status — compact */}
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-sm border flex-shrink-0',
                    getStatusClass(apt.status)
                  )}>
                    {getStatusLabel(apt.status, language)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/25 mb-3" />
              <p className="text-sm text-muted-foreground">
                {ar ? 'لا توجد مواعيد اليوم' : 'No appointments today'}
              </p>
              <button
                onClick={() => navigate('/calendar')}
                className="mt-3 text-xs font-semibold text-primary hover:underline"
              >
                {ar ? 'إضافة موعد' : '+ Add appointment'}
              </button>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Monthly revenue — hero number, not a card-in-a-card */}
          <div className="bg-foreground text-background rounded-lg p-5">
            {statsLoading ? (
              <><Skeleton className="h-4 w-28 mb-3 bg-background/20" /><Skeleton className="h-10 w-36 bg-background/20" /></>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-background/50 mb-3">
                  {ar ? 'إيرادات الشهر' : 'Month to date'}
                </p>
                <p className="stat-number text-3xl font-bold leading-none">
                  {fmt(stats?.monthlyRevenue ?? 0)}
                  <span className="text-lg font-normal text-background/50 ml-1">{currency}</span>
                </p>
                <p className="text-[11px] text-background/40 mt-2">
                  {format(today, 'MMMM yyyy')}
                </p>
              </>
            )}
          </div>

          {/* Status breakdown — tight list, no card-per-item */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60">
              <h3 className="text-xs font-semibold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                {ar ? 'ملخص اليوم' : "Today's Status"}
              </h3>
            </div>
            {statsLoading ? (
              <div className="p-3 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : (
              <div>
                {[
                  { icon: CheckCircle2, label: ar ? 'مكتملة' : 'Completed',  val: stats?.completedToday ?? 0, color: 'text-emerald-600' },
                  { icon: Activity,     label: ar ? 'جارٍ' : 'In progress',  val: stats?.inServiceToday ?? 0, color: 'text-blue-600' },
                  { icon: AlertCircle,  label: ar ? 'معلقة' : 'Pending',     val: stats?.pendingToday  ?? 0,  color: 'text-amber-600' },
                ].map(({ icon: Icon, label, val, color }) => (
                  <div key={label} className="data-row justify-between">
                    <div className="flex items-center gap-2.5">
                      <Icon className={cn('h-3.5 w-3.5', color)} />
                      <span className="text-sm">{label}</span>
                    </div>
                    <span className={cn('text-sm font-bold stat-number', color)}>{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions — compact text links, not buttons */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60">
              <h3 className="text-xs font-semibold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                {ar ? 'روابط سريعة' : 'Quick links'}
              </h3>
            </div>
            <div className="divide-y divide-border/40">
              {[
                { icon: Calendar,   label: ar ? 'التقويم' : 'Calendar',  to: '/calendar' },
                { icon: UserPlus,   label: ar ? 'العميلات' : 'Clients',  to: '/clients' },
                { icon: Scissors,   label: ar ? 'الخدمات' : 'Services',  to: '/services' },
                { icon: TrendingUp, label: ar ? 'التقارير' : 'Reports',  to: '/reports' },
              ].map(({ icon: Icon, label, to }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors text-left"
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {label}
                  <ArrowRight className="h-3 w-3 ml-auto opacity-40" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
