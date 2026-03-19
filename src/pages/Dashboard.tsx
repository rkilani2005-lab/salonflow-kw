import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LowStockAlerts } from '@/components/dashboard/LowStockAlerts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  UserPlus,
  Scissors,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'in_service': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'confirmed': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed': return 'Done';
    case 'in_service': return 'In Progress';
    case 'confirmed': return 'Confirmed';
    case 'planned': return 'Scheduled';
    default: return status;
  }
};

function useDashboardStats(tenantId?: string) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 }).toISOString();
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 }).toISOString();
  const monthStart = startOfMonth(today).toISOString();
  const monthEnd = endOfMonth(today).toISOString();

  return useQuery({
    queryKey: ['dashboard-stats', tenantId, todayStr],
    queryFn: async () => {
      const [todayBookings, weekRevenue, monthRevenue, allClients, newClients, todayTransactions] =
        await Promise.all([
          supabase.from('bookings').select('id, status').gte('created_at', todayStart).lte('created_at', todayEnd),
          supabase.from('transactions').select('grand_total').eq('status', 'completed').gte('created_at', weekStart).lte('created_at', weekEnd),
          supabase.from('transactions').select('grand_total').eq('status', 'completed').gte('created_at', monthStart).lte('created_at', monthEnd),
          supabase.from('clients').select('id', { count: 'exact', head: true }),
          supabase.from('clients').select('id', { count: 'exact', head: true }).gte('created_at', monthStart).lte('created_at', monthEnd),
          supabase.from('transactions').select('grand_total').eq('status', 'completed').gte('created_at', todayStart).lte('created_at', todayEnd),
        ]);

      const appts = todayBookings.data || [];
      const todayRev = (todayTransactions.data || []).reduce((s, t) => s + Number(t.grand_total), 0);
      const weekRev  = (weekRevenue.data  || []).reduce((s, t) => s + Number(t.grand_total), 0);
      const monthRev = (monthRevenue.data || []).reduce((s, t) => s + Number(t.grand_total), 0);

      return {
        todayAppointments:  appts.length,
        completedToday:     appts.filter(b => b.status === 'completed').length,
        inServiceToday:     appts.filter(b => b.status === 'in_service').length,
        pendingToday:       appts.filter(b => b.status === 'confirmed' || b.status === 'planned').length,
        todayRevenue:       todayRev,
        weeklyRevenue:      weekRev,
        monthlyRevenue:     monthRev,
        activeClients:      allClients.count || 0,
        newClientsThisMonth: newClients.count || 0,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });
}

function useTodayAppointments(tenantId?: string) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['today-appointments', tenantId, todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, start_time, client_name, service_name, staff_id, status, staff:staff_id(name)')
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

function StatCard({ title, icon: Icon, loading, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></>
        ) : children}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { tenant, currentBranch } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const currency = tenant?.currency || 'KWD';

  const { data: stats, isLoading: statsLoading } = useDashboardStats(tenant?.id);
  const { data: appointments, isLoading: aptsLoading } = useTodayAppointments(tenant?.id);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {format(today, 'EEEE, MMMM d, yyyy')} • {currentBranch?.name || 'Main Branch'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/clients')}>
            <UserPlus className="h-4 w-4 mr-2" />New Client
          </Button>
          <Button onClick={() => navigate('/calendar')}>
            <Calendar className="h-4 w-4 mr-2" />Book Appointment
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Appointments" icon={Calendar} loading={statsLoading}>
          <div className="text-2xl font-bold">{stats?.todayAppointments ?? 0}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-emerald-600">{stats?.completedToday ?? 0} completed</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-amber-600">{stats?.pendingToday ?? 0} pending</span>
          </div>
        </StatCard>

        <StatCard title="Today's Revenue" icon={DollarSign} loading={statsLoading}>
          <div className="text-2xl font-bold">{(stats?.todayRevenue ?? 0).toFixed(3)} {currency}</div>
          <p className="text-xs text-muted-foreground mt-1">From completed transactions</p>
        </StatCard>

        <StatCard title="Weekly Revenue" icon={TrendingUp} loading={statsLoading}>
          <div className="text-2xl font-bold">{(stats?.weeklyRevenue ?? 0).toFixed(3)} {currency}</div>
          <p className="text-xs text-muted-foreground mt-1">This week</p>
        </StatCard>

        <StatCard title="Active Clients" icon={Users} loading={statsLoading}>
          <div className="text-2xl font-bold">{stats?.activeClients ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">
            +{stats?.newClientsThisMonth ?? 0} new this month
          </p>
        </StatCard>
      </div>

      {/* Low Stock Alerts */}
      <LowStockAlerts />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Today's Schedule</CardTitle>
              <CardDescription>Appointments booked for today</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {aptsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : appointments && appointments.length > 0 ? (
              <div className="space-y-3">
                {appointments.map((apt: any) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[50px]">
                        <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <span className="text-sm font-medium">{apt.start_time?.slice(0, 5)}</span>
                      </div>
                      <div>
                        <p className="font-medium">{apt.client_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {apt.service_name} • {(apt.staff as any)?.name || '—'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(apt.status)}>
                      {getStatusLabel(apt.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No appointments today</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/calendar')}>
                <Calendar className="h-5 w-5" /><span className="text-xs">New Booking</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/clients')}>
                <UserPlus className="h-5 w-5" /><span className="text-xs">Add Client</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/services')}>
                <Scissors className="h-5 w-5" /><span className="text-xs">Services</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/reports')}>
                <TrendingUp className="h-5 w-5" /><span className="text-xs">Reports</span>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Today's Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {statsLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-sm">Completed</span></div>
                    <span className="font-medium">{stats?.completedToday ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" /><span className="text-sm">In Progress</span></div>
                    <span className="font-medium">{stats?.inServiceToday ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-500" /><span className="text-sm">Pending</span></div>
                    <span className="font-medium">{stats?.pendingToday ?? 0}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Revenue</CardTitle>
              <CardDescription>Performance this month</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <><Skeleton className="h-10 w-32 mb-2" /><Skeleton className="h-4 w-24" /></>
              ) : (
                <>
                  <div className="text-3xl font-bold">{(stats?.monthlyRevenue ?? 0).toFixed(3)} {currency}</div>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-600">Current month total</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
