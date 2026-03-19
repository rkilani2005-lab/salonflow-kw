import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, DollarSign, Calendar, Users, Download, ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  format, subDays, startOfDay, endOfDay, eachDayOfInterval,
  startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek,
} from 'date-fns';

type DateRange = '7d' | '30d' | '90d' | '1y';

function getDateBounds(range: DateRange) {
  const now = new Date();
  switch (range) {
    case '7d':  return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '30d': return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case '90d': return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) };
    case '1y':  return { from: startOfDay(subDays(now, 364)), to: endOfDay(now) };
  }
}

function useRevenueData(tenantId: string | undefined, range: DateRange) {
  const { from, to } = getDateBounds(range);
  return useQuery({
    queryKey: ['reports-revenue', tenantId, range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('grand_total, created_at')
        .eq('status', 'completed')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());
      if (error) throw error;

      const days = eachDayOfInterval({ start: from, end: to });
      const grouped: Record<string, number> = {};
      days.forEach(d => { grouped[format(d, 'yyyy-MM-dd')] = 0; });
      (data || []).forEach(t => {
        const key = format(new Date(t.created_at), 'yyyy-MM-dd');
        if (key in grouped) grouped[key] += Number(t.grand_total);
      });

      return Object.entries(grouped).map(([date, revenue]) => ({
        name: range === '7d' ? format(new Date(date), 'EEE') : format(new Date(date), 'MMM d'),
        revenue: Math.round(revenue * 1000) / 1000,
      }));
    },
    enabled: !!tenantId,
  });
}

function useMonthlyTrend(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['reports-monthly-trend', tenantId],
    queryFn: async () => {
      const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
      const results = await Promise.all(
        months.map(async (m) => {
          const { data } = await supabase
            .from('transactions')
            .select('grand_total')
            .eq('status', 'completed')
            .gte('created_at', startOfMonth(m).toISOString())
            .lte('created_at', endOfMonth(m).toISOString());
          const rev = (data || []).reduce((s, t) => s + Number(t.grand_total), 0);
          return { name: format(m, 'MMM'), revenue: Math.round(rev * 1000) / 1000 };
        })
      );
      return results;
    },
    enabled: !!tenantId,
  });
}

function useServiceBreakdown(tenantId: string | undefined, range: DateRange) {
  const { from, to } = getDateBounds(range);
  return useQuery({
    queryKey: ['reports-services', tenantId, range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_items')
        .select('item_name, item_type, total_price')
        .eq('item_type', 'service')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());
      if (error) throw error;

      const grouped: Record<string, { revenue: number; bookings: number }> = {};
      (data || []).forEach(item => {
        if (!grouped[item.item_name]) grouped[item.item_name] = { revenue: 0, bookings: 0 };
        grouped[item.item_name].revenue += Number(item.total_price);
        grouped[item.item_name].bookings += 1;
      });

      const COLORS = ['#7C3AED', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
      return Object.entries(grouped)
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .slice(0, 6)
        .map(([name, vals], i) => ({
          name,
          value: Math.round(vals.revenue * 10) / 10,
          bookings: vals.bookings,
          revenue: Math.round(vals.revenue * 1000) / 1000,
          color: COLORS[i % COLORS.length],
        }));
    },
    enabled: !!tenantId,
  });
}

function useStaffPerformance(tenantId: string | undefined, range: DateRange) {
  const { from, to } = getDateBounds(range);
  return useQuery({
    queryKey: ['reports-staff', tenantId, range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('grand_total, staff_id, staff:staff_id(name)')
        .eq('status', 'completed')
        .not('staff_id', 'is', null)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());
      if (error) throw error;

      const grouped: Record<string, { name: string; revenue: number; appointments: number }> = {};
      (data || []).forEach((t: any) => {
        const sid = t.staff_id as string;
        if (!grouped[sid]) grouped[sid] = { name: t.staff?.name || 'Unknown', revenue: 0, appointments: 0 };
        grouped[sid].revenue += Number(t.grand_total);
        grouped[sid].appointments += 1;
      });

      return Object.values(grouped)
        .sort((a, b) => b.revenue - a.revenue)
        .map(s => ({ ...s, revenue: Math.round(s.revenue * 1000) / 1000 }));
    },
    enabled: !!tenantId,
  });
}

function useKPIs(tenantId: string | undefined, range: DateRange) {
  const { from, to } = getDateBounds(range);
  const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
  return useQuery({
    queryKey: ['reports-kpis', tenantId, range],
    queryFn: async () => {
      const [curr, prev, bookings, clients] = await Promise.all([
        supabase.from('transactions').select('grand_total').eq('status', 'completed')
          .gte('created_at', from.toISOString()).lte('created_at', to.toISOString()),
        supabase.from('transactions').select('grand_total').eq('status', 'completed')
          .gte('created_at', prevFrom.toISOString()).lte('created_at', from.toISOString()),
        supabase.from('bookings').select('id', { count: 'exact', head: true })
          .gte('created_at', from.toISOString()).lte('created_at', to.toISOString()),
        supabase.from('clients').select('id', { count: 'exact', head: true })
          .gte('created_at', from.toISOString()).lte('created_at', to.toISOString()),
      ]);

      const currRev = (curr.data || []).reduce((s, t) => s + Number(t.grand_total), 0);
      const prevRev = (prev.data || []).reduce((s, t) => s + Number(t.grand_total), 0);
      const totalBookings = bookings.count || 0;
      const revChange = prevRev > 0 ? ((currRev - prevRev) / prevRev) * 100 : 0;
      const avgTicket = totalBookings > 0 ? currRev / totalBookings : 0;

      return {
        totalRevenue: Math.round(currRev * 1000) / 1000,
        revenueChange: Math.round(revChange * 10) / 10,
        totalBookings,
        avgTicket: Math.round(avgTicket * 1000) / 1000,
        newClients: clients.count || 0,
      };
    },
    enabled: !!tenantId,
  });
}

export default function Reports() {
  const { tenant } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const currency = tenant?.currency || 'KWD';

  const { data: kpis, isLoading: kpisLoading } = useKPIs(tenant?.id, dateRange);
  const { data: revenueData, isLoading: revLoading } = useRevenueData(tenant?.id, dateRange);
  const { data: monthlyTrend, isLoading: trendLoading } = useMonthlyTrend(tenant?.id);
  const { data: serviceData, isLoading: svcLoading } = useServiceBreakdown(tenant?.id, dateRange);
  const { data: staffData, isLoading: staffLoading } = useStaffPerformance(tenant?.id, dateRange);

  const maxAppointments = staffData ? Math.max(...staffData.map(s => s.appointments), 1) : 1;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Track your salon's performance and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">This year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Total Revenue', icon: DollarSign,
            value: kpisLoading ? null : `${kpis?.totalRevenue.toFixed(3)} ${currency}`,
            sub: kpis ? (kpis.revenueChange >= 0
              ? <span className="text-xs text-emerald-600 flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />+{kpis.revenueChange}% vs prior period</span>
              : <span className="text-xs text-red-600">↓ {Math.abs(kpis.revenueChange)}% vs prior period</span>
            ) : null,
          },
          {
            title: 'Total Bookings', icon: Calendar,
            value: kpisLoading ? null : kpis?.totalBookings,
            sub: <span className="text-xs text-muted-foreground">In selected period</span>,
          },
          {
            title: 'Avg. Ticket Size', icon: TrendingUp,
            value: kpisLoading ? null : `${kpis?.avgTicket.toFixed(3)} ${currency}`,
            sub: <span className="text-xs text-muted-foreground">Per transaction</span>,
          },
          {
            title: 'New Clients', icon: Users,
            value: kpisLoading ? null : kpis?.newClients,
            sub: <span className="text-xs text-muted-foreground">Joined in period</span>,
          },
        ].map(({ title, icon: Icon, value, sub }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {value === null ? (
                <><Skeleton className="h-8 w-28 mb-1" /><Skeleton className="h-4 w-24" /></>
              ) : (
                <><div className="text-2xl font-bold">{value}</div><div className="mt-1">{sub}</div></>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="staff">Staff Performance</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Revenue</CardTitle>
                <CardDescription>Revenue breakdown for selected period</CardDescription>
              </CardHeader>
              <CardContent>
                {revLoading ? <Skeleton className="h-[300px] w-full" /> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Monthly revenue over last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                {trendLoading ? <Skeleton className="h-[300px] w-full" /> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Service</CardTitle>
                <CardDescription>Top services by revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {svcLoading ? <Skeleton className="h-[300px] w-full" /> : serviceData && serviceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={serviceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                        {serviceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                    No service data for this period
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Services</CardTitle>
                <CardDescription>Most booked services this period</CardDescription>
              </CardHeader>
              <CardContent>
                {svcLoading ? (
                  <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : serviceData && serviceData.length > 0 ? (
                  <div className="space-y-4">
                    {serviceData.map((service, index) => (
                      <div key={service.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">{index + 1}</span>
                          <div>
                            <p className="font-medium text-sm">{service.name}</p>
                            <p className="text-xs text-muted-foreground">{service.bookings} bookings</p>
                          </div>
                        </div>
                        <span className="font-medium">{service.revenue} {currency}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">No service data for this period</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
              <CardDescription>Individual staff metrics for this period</CardDescription>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : staffData && staffData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Staff Member</th>
                        <th className="text-center py-3 px-4 font-medium">Appointments</th>
                        <th className="text-center py-3 px-4 font-medium">Revenue</th>
                        <th className="text-center py-3 px-4 font-medium">Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffData.map((staff, index) => (
                        <tr key={staff.name} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">{staff.name.charAt(0)}</span>
                              </div>
                              <span className="font-medium">{staff.name}</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-4">{staff.appointments}</td>
                          <td className="text-center py-3 px-4">{staff.revenue} {currency}</td>
                          <td className="text-center py-3 px-4 min-w-[120px]">
                            <div className="w-full bg-muted rounded-full h-2">
                              <div className="bg-primary h-2 rounded-full" style={{ width: `${(staff.appointments / maxAppointments) * 100}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">No staff transaction data for this period</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
