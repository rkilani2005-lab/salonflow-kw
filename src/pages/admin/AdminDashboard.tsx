import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, CreditCard, TrendingUp, Calendar, DollarSign } from 'lucide-react';

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<PlatformStats>({
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    totalUsers: 0,
    totalBookings: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch tenant stats
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, is_active, is_trial');

        // Fetch user stats
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id');

        // Fetch booking stats
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, price');

        const totalRevenue = bookings?.reduce((sum, b) => sum + Number(b.price || 0), 0) || 0;

        setStats({
          totalTenants: tenants?.length || 0,
          activeTenants: tenants?.filter(t => t.is_active).length || 0,
          trialTenants: tenants?.filter(t => t.is_trial).length || 0,
          totalUsers: profiles?.length || 0,
          totalBookings: bookings?.length || 0,
          totalRevenue,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Tenants',
      value: stats.totalTenants,
      description: `${stats.activeTenants} active, ${stats.trialTenants} on trial`,
      icon: Building2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      description: 'Across all tenants',
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Bookings',
      value: stats.totalBookings,
      description: 'Platform-wide',
      icon: Calendar,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Total Revenue',
      value: `${stats.totalRevenue.toFixed(3)} KWD`,
      description: 'From all bookings',
      icon: DollarSign,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

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
        <h1 className="text-3xl font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground">Overview of all SaaS operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/admin/tenants" className="block p-3 rounded-lg hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Manage Tenants</p>
                  <p className="text-sm text-muted-foreground">View and edit salon accounts</p>
                </div>
              </div>
            </a>
            <a href="/admin/subscriptions" className="block p-3 rounded-lg hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Subscription Management</p>
                  <p className="text-sm text-muted-foreground">Override plans and trials</p>
                </div>
              </div>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform events</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity feed coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
