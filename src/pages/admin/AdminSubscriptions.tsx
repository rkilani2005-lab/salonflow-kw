import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { Sparkles, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  is_trial: boolean;
  trial_ends_at: string | null;
  subscription_plan: string | null;
  is_active: boolean;
}

const AdminSubscriptions = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, is_trial, trial_ends_at, subscription_plan, is_active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const filteredTenants = tenants.filter(tenant => {
    if (filter === 'all') return true;
    if (filter === 'trial') return tenant.is_trial;
    if (filter === 'expiring') {
      if (!tenant.is_trial || !tenant.trial_ends_at) return false;
      const daysLeft = differenceInDays(new Date(tenant.trial_ends_at), new Date());
      return daysLeft <= 3 && daysLeft >= 0;
    }
    return tenant.subscription_plan === filter;
  });

  const updatePlan = async (tenantId: string, plan: string) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ subscription_plan: plan as any })
        .eq('id', tenantId);

      if (error) throw error;
      toast.success('Plan updated successfully');
      fetchTenants();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update plan');
    }
  };

  const extendTrial = async (tenantId: string, days: number) => {
    try {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + days);

      const { error } = await supabase
        .from('tenants')
        .update({
          is_trial: true,
          trial_ends_at: newDate.toISOString(),
        })
        .eq('id', tenantId);

      if (error) throw error;
      toast.success(`Trial extended by ${days} days`);
      fetchTenants();
    } catch (error) {
      console.error('Error extending trial:', error);
      toast.error('Failed to extend trial');
    }
  };

  const endTrial = async (tenantId: string) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ is_trial: false })
        .eq('id', tenantId);

      if (error) throw error;
      toast.success('Trial ended');
      fetchTenants();
    } catch (error) {
      console.error('Error ending trial:', error);
      toast.error('Failed to end trial');
    }
  };

  const getTrialStatus = (tenant: Tenant) => {
    if (!tenant.is_trial) {
      return <Badge variant="outline">Paid</Badge>;
    }
    if (!tenant.trial_ends_at) {
      return <Badge variant="secondary">Trial</Badge>;
    }
    const daysLeft = differenceInDays(new Date(tenant.trial_ends_at), new Date());
    if (daysLeft < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (daysLeft <= 3) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {daysLeft}d left
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        {daysLeft}d left
      </Badge>
    );
  };

  // Stats
  const trialCount = tenants.filter(t => t.is_trial).length;
  const expiringCount = tenants.filter(t => {
    if (!t.is_trial || !t.trial_ends_at) return false;
    const daysLeft = differenceInDays(new Date(t.trial_ends_at), new Date());
    return daysLeft <= 3 && daysLeft >= 0;
  }).length;
  const paidCount = tenants.filter(t => !t.is_trial).length;

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
        <h1 className="text-3xl font-bold">Subscription Management</h1>
        <p className="text-muted-foreground">Manage tenant plans and trials</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{tenants.length}</div>
            <p className="text-xs text-muted-foreground">Total Tenants</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-500">{trialCount}</div>
            <p className="text-xs text-muted-foreground">On Trial</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-500">{expiringCount}</div>
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">{paidCount}</div>
            <p className="text-xs text-muted-foreground">Paid</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscription Overview</CardTitle>
              <CardDescription>Manage plans and trial periods</CardDescription>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="trial">On Trial</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="ai">AI</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Trial Status</TableHead>
                <TableHead>Trial Ends</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>
                    <Select
                      value={tenant.subscription_plan || 'starter'}
                      onValueChange={(value) => updatePlan(tenant.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="ai">AI</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{getTrialStatus(tenant)}</TableCell>
                  <TableCell>
                    {tenant.trial_ends_at
                      ? format(new Date(tenant.trial_ends_at), 'MMM d, yyyy')
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {tenant.is_trial ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => extendTrial(tenant.id, 7)}
                        >
                          +7 days
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => extendTrial(tenant.id, 14)}
                        >
                          +14 days
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => endTrial(tenant.id)}
                        >
                          End Trial
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => extendTrial(tenant.id, 14)}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Start Trial
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSubscriptions;
