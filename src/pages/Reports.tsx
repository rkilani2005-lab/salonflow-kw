import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Users, 
  Download,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

// Mock data for charts
const revenueData = [
  { name: 'Mon', revenue: 420, bookings: 8 },
  { name: 'Tue', revenue: 380, bookings: 7 },
  { name: 'Wed', revenue: 520, bookings: 10 },
  { name: 'Thu', revenue: 610, bookings: 12 },
  { name: 'Fri', revenue: 780, bookings: 15 },
  { name: 'Sat', revenue: 920, bookings: 18 },
  { name: 'Sun', revenue: 450, bookings: 9 },
];

const monthlyTrendData = [
  { name: 'Jan', revenue: 8500 },
  { name: 'Feb', revenue: 9200 },
  { name: 'Mar', revenue: 10100 },
  { name: 'Apr', revenue: 9800 },
  { name: 'May', revenue: 11200 },
  { name: 'Jun', revenue: 12500 },
];

const serviceBreakdownData = [
  { name: 'Hair Services', value: 45, color: '#7C3AED' },
  { name: 'Nail Services', value: 25, color: '#06B6D4' },
  { name: 'Facial & Skincare', value: 18, color: '#10B981' },
  { name: 'Makeup', value: 8, color: '#F59E0B' },
  { name: 'Other', value: 4, color: '#6B7280' },
];

const staffPerformanceData = [
  { name: 'Fatima', appointments: 45, revenue: 2800, rating: 4.9 },
  { name: 'Noura', appointments: 38, revenue: 2200, rating: 4.8 },
  { name: 'Dana', appointments: 32, revenue: 1900, rating: 4.7 },
  { name: 'Sara', appointments: 28, revenue: 1600, rating: 4.6 },
];

const topServicesData = [
  { name: 'Hair Color', bookings: 42, revenue: 3150 },
  { name: 'Haircut & Blowout', bookings: 38, revenue: 1520 },
  { name: 'Gel Manicure', bookings: 35, revenue: 700 },
  { name: 'Classic Facial', bookings: 28, revenue: 1680 },
  { name: 'Full Set Nails', bookings: 24, revenue: 1200 },
];

export default function Reports() {
  const [dateRange, setDateRange] = useState('7d');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Track your salon's performance and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">This year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4,080 KWD</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-emerald-600">+12.5% from last period</span>
            </div>
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
            <div className="text-2xl font-bold">79</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-emerald-600">+8 from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Ticket Size
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">51.6 KWD</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-emerald-600">+3.2% from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Client Retention
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78%</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              <span className="text-xs text-red-600">-2% from last period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="staff">Staff Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Revenue */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Revenue</CardTitle>
                <CardDescription>Revenue breakdown by day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Monthly revenue over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Service Breakdown Pie */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
                <CardDescription>Service category distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={serviceBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {serviceBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Services */}
            <Card>
              <CardHeader>
                <CardTitle>Top Services</CardTitle>
                <CardDescription>Most booked services this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topServicesData.map((service, index) => (
                    <div key={service.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{service.name}</p>
                          <p className="text-xs text-muted-foreground">{service.bookings} bookings</p>
                        </div>
                      </div>
                      <span className="font-medium">{service.revenue} KWD</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
              <CardDescription>Individual staff metrics for this period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Staff Member</th>
                      <th className="text-center py-3 px-4 font-medium">Appointments</th>
                      <th className="text-center py-3 px-4 font-medium">Revenue</th>
                      <th className="text-center py-3 px-4 font-medium">Avg. Rating</th>
                      <th className="text-center py-3 px-4 font-medium">Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPerformanceData.map((staff, index) => (
                      <tr key={staff.name} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {staff.name.charAt(0)}
                              </span>
                            </div>
                            <span className="font-medium">{staff.name}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">{staff.appointments}</td>
                        <td className="text-center py-3 px-4">{staff.revenue} KWD</td>
                        <td className="text-center py-3 px-4">
                          <span className="inline-flex items-center gap-1">
                            ⭐ {staff.rating}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${(staff.appointments / 50) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
