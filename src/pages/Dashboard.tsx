import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LowStockAlerts } from '@/components/dashboard/LowStockAlerts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Mock data for dashboard - will be replaced with real data
const mockStats = {
  todayAppointments: 12,
  todayRevenue: 485,
  weeklyRevenue: 2840,
  monthlyRevenue: 11200,
  activeClients: 156,
  newClientsThisMonth: 23,
  completedToday: 8,
  pendingToday: 4,
};

const mockTodayAppointments = [
  { id: '1', time: '09:00', client: 'Sarah Ahmed', service: 'Hair Color', staff: 'Fatima', status: 'completed' },
  { id: '2', time: '10:30', client: 'Mona Ali', service: 'Manicure', staff: 'Noura', status: 'completed' },
  { id: '3', time: '11:00', client: 'Reem Hassan', service: 'Haircut', staff: 'Fatima', status: 'in_service' },
  { id: '4', time: '12:30', client: 'Layla Khalid', service: 'Facial', staff: 'Dana', status: 'confirmed' },
  { id: '5', time: '14:00', client: 'Nada Omar', service: 'Full Set Nails', staff: 'Noura', status: 'planned' },
  { id: '6', time: '15:30', client: 'Huda Salem', service: 'Blowout', staff: 'Fatima', status: 'planned' },
];

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

export default function Dashboard() {
  const { tenant, currentBranch } = useAuth();
  const navigate = useNavigate();
  const today = new Date();

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
            <UserPlus className="h-4 w-4 mr-2" />
            New Client
          </Button>
          <Button onClick={() => navigate('/calendar')}>
            <Calendar className="h-4 w-4 mr-2" />
            Book Appointment
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Appointments
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.todayAppointments}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-emerald-600">{mockStats.completedToday} completed</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-amber-600">{mockStats.pendingToday} pending</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.todayRevenue} KWD</div>
            <p className="text-xs text-muted-foreground mt-1">
              +12% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Weekly Revenue
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.weeklyRevenue.toLocaleString()} KWD</div>
            <p className="text-xs text-emerald-600 mt-1">
              +8.2% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Clients
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.activeClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{mockStats.newClientsThisMonth} new this month
            </p>
          </CardContent>
        </Card>
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
              <CardDescription>Upcoming appointments for today</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockTodayAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[50px]">
                      <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                      <span className="text-sm font-medium">{apt.time}</span>
                    </div>
                    <div>
                      <p className="font-medium">{apt.client}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.service} • {apt.staff}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(apt.status)}>
                    {getStatusLabel(apt.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Stats */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/calendar')}>
                <Calendar className="h-5 w-5" />
                <span className="text-xs">New Booking</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/clients')}>
                <UserPlus className="h-5 w-5" />
                <span className="text-xs">Add Client</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/services')}>
                <Scissors className="h-5 w-5" />
                <span className="text-xs">Services</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/reports')}>
                <TrendingUp className="h-5 w-5" />
                <span className="text-xs">Reports</span>
              </Button>
            </CardContent>
          </Card>

          {/* Today's Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today's Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm">Completed</span>
                </div>
                <span className="font-medium">{mockStats.completedToday}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">In Progress</span>
                </div>
                <span className="font-medium">1</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Pending</span>
                </div>
                <span className="font-medium">{mockStats.pendingToday}</span>
              </div>
            </CardContent>
          </Card>

          {/* Revenue This Month */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Revenue</CardTitle>
              <CardDescription>Performance this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{mockStats.monthlyRevenue.toLocaleString()} KWD</div>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-emerald-600">+15.3% vs last month</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
