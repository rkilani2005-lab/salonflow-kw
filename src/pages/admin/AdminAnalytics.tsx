import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Building2, Calendar, DollarSign } from 'lucide-react';

interface AnalyticsData {
  planDistribution: { name: string; value: number }[];
  monthlyGrowth: { month: string; tenants: number; users: number }[];
  bookingStats: { status: string; count: number }[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#82ca9d'];

const AdminAnalytics = () => {
  const [data, setData] = useState<AnalyticsData>({
    planDistribution: [],
    monthlyGrowth: [],
    bookingStats: [],
  });
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    tenants: 0,
    users: 0,
    bookings: 0,
    revenue: 0,
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Fetch tenants
        const { data: tenants } = await supabase.from('tenants').select('subscription_plan, created_at');

        // Fetch profiles
        const { data: profiles } = await supabase.from('profiles').select('id');

        // Fetch bookings
        const { data: bookings } = await supabase.from('bookings').select('status, price');

        // Calculate plan distribution
        const planCounts: Record<string, number> = { starter: 0, professional: 0, ai: 0 };
        tenants?.forEach(t => {
          const plan = t.subscription_plan || 'starter';
          planCounts[plan] = (planCounts[plan] || 0) + 1;
        });

        // Calculate booking status distribution
        const statusCounts: Record<string, number> = {};
        bookings?.forEach(b => {
          statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
        });

        const totalRevenue = bookings?.reduce((sum, b) => sum + Number(b.price || 0), 0) || 0;

        setData({
          planDistribution: Object.entries(planCounts).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
          })),
          monthlyGrowth: [], // Would need time-series data
          bookingStats: Object.entries(statusCounts).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
            count,
          })),
        });

        setTotals({
          tenants: tenants?.length || 0,
          users: profiles?.length || 0,
          bookings: bookings?.length || 0,
          revenue: totalRevenue,
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="text-muted-foreground">Insights across all tenants</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tenants
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.tenants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.users}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bookings
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.bookings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.revenue.toFixed(3)} KWD</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
            <CardDescription>Tenants by subscription plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.planDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.planDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking Status</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.bookingStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
