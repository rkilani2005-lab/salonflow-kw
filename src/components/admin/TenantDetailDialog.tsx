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
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Building2, Users, Scissors, MapPin, Phone, Mail,
  User, CreditCard, CheckCircle, XCircle, Calendar, ShieldCheck,
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  subscription_plan: string | null;
  onboarding_completed: boolean | null;
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

interface OwnerProfile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  tenant_id: string | null;
}

interface TenantDetailDialogProps {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const TenantDetailDialog = ({ tenant, open, onOpenChange, onUpdate }: TenantDetailDialogProps) => {
  const [stats, setStats] = useState<TenantStats>({ branches: 0, staff: 0, services: 0, clients: 0, bookings: 0 });
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [allStaff, setAllStaff] = useState<{ name: string; email: string | null; phone: string | null; color: string | null }[]>([]);
  const [branches, setBranches] = useState<{ name: string; address: string | null; phone: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subscription_plan: '',
    is_trial: false,
    trial_ends_at: '',
    currency: 'KWD',
  });

  useEffect(() => {
    if (tenant && open) {
      fetchTenantData();
      setFormData({
        name: tenant.name,
        subscription_plan: tenant.subscription_plan || 'starter',
        is_trial: tenant.is_trial,
        trial_ends_at: tenant.trial_ends_at ? format(new Date(tenant.trial_ends_at), 'yyyy-MM-dd') : '',
        currency: tenant.currency || 'KWD',
      });
    }
  }, [tenant, open]);

  const fetchTenantData = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [branchesRes, staffRes, servicesRes, clientsRes, ownerRoleRes] = await Promise.all([
        supabase.from('branches').select('name, address, phone').eq('tenant_id', tenant.id),
        supabase.from('staff').select('name, email, phone, color').eq('tenant_id', tenant.id).eq('is_active', true),
        supabase.from('services').select('id', { count: 'exact' }).eq('tenant_id', tenant.id),
        supabase.from('clients').select('id', { count: 'exact' }).eq('tenant_id', tenant.id),
        supabase.from('user_roles').select('user_id').eq('tenant_id', tenant.id).eq('role', 'owner').limit(1),
      ]);

      setBranches(branchesRes.data || []);
      setAllStaff(staffRes.data || []);
      setStats({
        branches: branchesRes.data?.length || 0,
        staff: staffRes.data?.length || 0,
        services: servicesRes.count || 0,
        clients: clientsRes.count || 0,
        bookings: 0,
      });

      // Fetch owner profile
      const ownerUserId = ownerRoleRes.data?.[0]?.user_id;
      if (ownerUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone, tenant_id')
          .eq('user_id', ownerUserId)
          .single();
        setOwner(profile);
      } else {
        setOwner(null);
      }
    } catch (err) {
      console.error('Error fetching tenant data:', err);
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
          currency: formData.currency,
        })
        .eq('id', tenant.id);

      if (error) throw error;
      toast.success('Tenant updated successfully');
      onUpdate();
    } catch (err) {
      console.error('Error updating tenant:', err);
      toast.error('Failed to update tenant');
    }
  };

  if (!tenant) return null;

  const planColor: Record<string, string> = {
    ai: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
    professional: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
    starter: 'bg-muted text-muted-foreground',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-14 w-14 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl">{tenant.name}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center flex-wrap gap-2">
                <span>Joined {format(new Date(tenant.created_at), 'MMMM d, yyyy')}</span>
                <Badge variant="outline" className={planColor[tenant.subscription_plan || 'starter']}>
                  {(tenant.subscription_plan || 'starter').charAt(0).toUpperCase() + (tenant.subscription_plan || 'starter').slice(1)}
                </Badge>
                {tenant.is_active ? (
                  <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
                    <CheckCircle className="h-3 w-3 mr-1" />Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30">
                    <XCircle className="h-3 w-3 mr-1" />Suspended
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>

          {/* ─── Overview ─── */}
          <TabsContent value="overview" className="space-y-4 pt-2">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Branches', value: stats.branches, icon: MapPin },
                { label: 'Staff', value: stats.staff, icon: Users },
                { label: 'Services', value: stats.services, icon: Scissors },
                { label: 'Clients', value: stats.clients, icon: Users },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardContent className="pt-3 pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{value}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Subscription details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Plan</span>
                  <Badge variant="outline" className={planColor[tenant.subscription_plan || 'starter']}>
                    {tenant.subscription_plan || 'starter'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-medium">{tenant.currency || 'KWD'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Onboarding</span>
                  <span className={tenant.onboarding_completed ? 'text-green-600 font-medium' : 'text-amber-500'}>
                    {tenant.onboarding_completed ? '✓ Completed' : '⏳ Pending'}
                  </span>
                </div>
                {tenant.is_trial && tenant.trial_ends_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Trial Ends</span>
                    <span>{format(new Date(tenant.trial_ends_at), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Branches */}
            {branches.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" />Branches
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {branches.map((b, i) => (
                    <div key={i} className="flex items-start justify-between text-sm p-2 rounded-lg bg-muted/30">
                      <div>
                        <p className="font-medium">{b.name}</p>
                        {b.address && <p className="text-xs text-muted-foreground">{b.address}</p>}
                      </div>
                      {b.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />{b.phone}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── Contacts ─── */}
          <TabsContent value="contacts" className="space-y-4 pt-2">
            {/* Owner */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />Owner Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : owner ? (
                  <div className="space-y-3">
                    {owner.full_name && (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="font-bold text-primary">{owner.full_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-semibold">{owner.full_name}</p>
                          <p className="text-xs text-muted-foreground">Owner</p>
                        </div>
                      </div>
                    )}
                    <Separator />
                    {owner.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <a href={`tel:${owner.phone}`} className="hover:text-primary transition-colors">
                          {owner.phone}
                        </a>
                      </div>
                    )}
                    {!owner.full_name && !owner.phone && (
                      <p className="text-sm text-muted-foreground">Profile not yet completed</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No owner profile found</p>
                )}
              </CardContent>
            </Card>

            {/* Staff list */}
            {allStaff.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />Staff Members ({allStaff.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {allStaff.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                          style={{ backgroundColor: s.color || 'hsl(220,9%,46%)' }}
                        >
                          {s.name.charAt(0)}
                        </div>
                        <span className="font-medium">{s.name}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {s.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />{s.phone}
                          </div>
                        )}
                        {s.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />{s.email}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── Edit ─── */}
          <TabsContent value="edit" className="space-y-4 pt-2">
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
                <Label>Subscription Plan</Label>
                <Select
                  value={formData.subscription_plan}
                  onValueChange={(v) => setFormData({ ...formData, subscription_plan: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="ai">AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => setFormData({ ...formData, currency: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KWD">KWD — Kuwaiti Dinar</SelectItem>
                    <SelectItem value="SAR">SAR — Saudi Riyal</SelectItem>
                    <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                    <SelectItem value="BHD">BHD — Bahraini Dinar</SelectItem>
                    <SelectItem value="QAR">QAR — Qatari Riyal</SelectItem>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Trial Status</Label>
                <Select
                  value={formData.is_trial ? 'true' : 'false'}
                  onValueChange={(v) => setFormData({ ...formData, is_trial: v === 'true' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
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

              <Button onClick={handleSave} className="w-full">Save Changes</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TenantDetailDialog;
