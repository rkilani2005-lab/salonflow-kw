import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Building2, Users, Scissors, Calendar, MapPin } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  subscription_plan: string | null;
  onboarding_completed: boolean;
  created_at: string;
  currency: string | null;
}

interface TenantStats {
  branches: number;
  staff: number;
  services: number;
  clients: number;
  bookings: number;
}

interface TenantDetailDialogProps {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const TenantDetailDialog = ({ tenant, open, onOpenChange, onUpdate }: TenantDetailDialogProps) => {
  const [stats, setStats] = useState<TenantStats>({
    branches: 0,
    staff: 0,
    services: 0,
    clients: 0,
    bookings: 0,
  });
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subscription_plan: '',
    is_trial: false,
    trial_ends_at: '',
  });

  useEffect(() => {
    if (tenant && open) {
      fetchTenantStats();
      setFormData({
        name: tenant.name,
        subscription_plan: tenant.subscription_plan || 'starter',
        is_trial: tenant.is_trial,
        trial_ends_at: tenant.trial_ends_at ? format(new Date(tenant.trial_ends_at), 'yyyy-MM-dd') : '',
      });
    }
  }, [tenant, open]);

  const fetchTenantStats = async () => {
    if (!tenant) return;
    
    setLoading(true);
    try {
      const [branchesRes, staffRes, servicesRes, clientsRes] = await Promise.all([
        supabase.from('branches').select('id', { count: 'exact' }).eq('tenant_id', tenant.id),
        supabase.from('staff').select('id', { count: 'exact' }).eq('tenant_id', tenant.id),
        supabase.from('services').select('id', { count: 'exact' }).eq('tenant_id', tenant.id),
        supabase.from('clients').select('id', { count: 'exact' }).eq('tenant_id', tenant.id),
      ]);

      setStats({
        branches: branchesRes.count || 0,
        staff: staffRes.count || 0,
        services: servicesRes.count || 0,
        clients: clientsRes.count || 0,
        bookings: 0, // Would need tenant_id on bookings to track this
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenant) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          subscription_plan: formData.subscription_plan as any,
          is_trial: formData.is_trial,
          trial_ends_at: formData.trial_ends_at ? new Date(formData.trial_ends_at).toISOString() : null,
        })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success('Tenant updated successfully');
      setEditMode(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast.error('Failed to update tenant');
    }
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            {tenant.name}
          </DialogTitle>
          <DialogDescription>
            Created {format(new Date(tenant.created_at), 'MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.branches}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Branches</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.staff}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Staff</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.services}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Services</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.clients}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Clients</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Subscription Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <Badge>{tenant.subscription_plan || 'starter'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={tenant.is_active ? 'default' : 'destructive'}>
                    {tenant.is_active ? 'Active' : 'Suspended'}
                  </Badge>
                </div>
                {tenant.is_trial && tenant.trial_ends_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trial Ends</span>
                    <span>{format(new Date(tenant.trial_ends_at), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Salon Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan">Subscription Plan</Label>
                <Select
                  value={formData.subscription_plan}
                  onValueChange={(value) => setFormData({ ...formData, subscription_plan: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="ai">AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trial">Trial Status</Label>
                <Select
                  value={formData.is_trial ? 'true' : 'false'}
                  onValueChange={(value) => setFormData({ ...formData, is_trial: value === 'true' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">On Trial</SelectItem>
                    <SelectItem value="false">Not on Trial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.is_trial && (
                <div className="space-y-2">
                  <Label htmlFor="trial_ends">Trial End Date</Label>
                  <Input
                    id="trial_ends"
                    type="date"
                    value={formData.trial_ends_at}
                    onChange={(e) => setFormData({ ...formData, trial_ends_at: e.target.value })}
                  />
                </div>
              )}

              <Button onClick={handleSave} className="w-full">
                Save Changes
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TenantDetailDialog;
