import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Eye, Ban, CheckCircle, Mail, Phone, Building2, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import TenantDetailDialog from '@/components/admin/TenantDetailDialog';

interface TenantOwner {
  full_name: string | null;
  phone: string | null;
  user_email: string | null;
}

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
  owner?: TenantOwner | null;
}

const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchTenants = async () => {
    try {
      const { data: tenantsData, error } = await supabase
        .from('tenants')
        .select('id, name, logo_url, is_active, is_trial, trial_ends_at, subscription_plan, currency, created_at, onboarding_completed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch owner profiles for each tenant
      const tenantIds = (tenantsData || []).map((t) => t.id);

      // Get owner user_ids from user_roles
      const { data: ownerRoles } = await supabase
        .from('user_roles')
        .select('user_id, tenant_id')
        .in('tenant_id', tenantIds)
        .eq('role', 'owner');

      // Get profiles for those users
      const ownerUserIds = (ownerRoles || []).map((r) => r.user_id);
      const { data: profiles } = ownerUserIds.length > 0
        ? await supabase.from('profiles').select('user_id, full_name, phone, tenant_id').in('user_id', ownerUserIds)
        : { data: [] };

      // Get emails from auth.users via service-role isn't available client-side,
      // so we match profile data and attach what we have
      const ownerMap: Record<string, TenantOwner> = {};
      (ownerRoles || []).forEach((role) => {
        const profile = (profiles || []).find((p) => p.user_id === role.user_id);
        ownerMap[role.tenant_id] = {
          full_name: profile?.full_name || null,
          phone: profile?.phone || null,
          user_email: null, // auth emails not accessible client-side
        };
      });

      const enriched: Tenant[] = (tenantsData || []).map((t) => ({
        ...t,
        owner: ownerMap[t.id] || null,
      }));

      setTenants(enriched);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const filteredTenants = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tenant.owner?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tenant.owner?.phone || '').includes(searchQuery)
  );

  const toggleTenantStatus = async (tenant: Tenant) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ is_active: !tenant.is_active })
        .eq('id', tenant.id);

      if (error) throw error;
      toast.success(`Tenant ${tenant.is_active ? 'suspended' : 'activated'}`);
      fetchTenants();
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast.error('Failed to update tenant');
    }
  };

  const getPlanBadge = (plan: string | null) => {
    switch (plan) {
      case 'ai':
        return <Badge className="bg-purple-500 text-white">AI</Badge>;
      case 'professional':
        return <Badge className="bg-blue-500 text-white">Professional</Badge>;
      case 'starter':
      default:
        return <Badge variant="secondary">Starter</Badge>;
    }
  };

  // Summary stats
  const totalActive = tenants.filter((t) => t.is_active).length;
  const totalTrial = tenants.filter((t) => t.is_trial).length;
  const onboarded = tenants.filter((t) => t.onboarding_completed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tenant Management</h1>
        <p className="text-muted-foreground">View and manage all salon accounts</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tenants', value: tenants.length, icon: Building2, color: 'text-primary' },
          { label: 'Active', value: totalActive, icon: CheckCircle, color: 'text-green-500' },
          { label: 'On Trial', value: totalTrial, icon: Calendar, color: 'text-amber-500' },
          { label: 'Onboarded', value: onboarded, icon: Users, color: 'text-blue-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-2xl font-bold">{value}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Tenants</CardTitle>
              <CardDescription>{filteredTenants.length} of {tenants.length} tenants</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, owner or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Salon</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trial</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No tenants found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => { setSelectedTenant(tenant); setDialogOpen(true); }}
                  >
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        {tenant.logo_url ? (
                          <img src={tenant.logo_url} alt={tenant.name} className="h-9 w-9 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-primary">{tenant.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-sm">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {tenant.onboarding_completed ? '✓ Onboarded' : '⏳ Pending setup'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenant.owner?.full_name ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-semibold">{tenant.owner.full_name.charAt(0)}</span>
                          </div>
                          <span className="text-sm font-medium">{tenant.owner.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {tenant.owner?.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{tenant.owner.phone}</span>
                          </div>
                        )}
                        {!tenant.owner?.phone && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(tenant.subscription_plan)}</TableCell>
                    <TableCell>
                      {tenant.is_active ? (
                        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
                          Suspended
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {tenant.is_trial ? (
                        <div>
                          <Badge variant="secondary" className="text-xs">Trial</Badge>
                          {tenant.trial_ends_at && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              until {format(new Date(tenant.trial_ends_at), 'MMM d')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedTenant(tenant); setDialogOpen(true); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleTenantStatus(tenant)}>
                            {tenant.is_active ? (
                              <><Ban className="h-4 w-4 mr-2" />Suspend Tenant</>
                            ) : (
                              <><CheckCircle className="h-4 w-4 mr-2" />Activate Tenant</>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TenantDetailDialog
        tenant={selectedTenant}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdate={fetchTenants}
      />
    </div>
  );
};

export default AdminTenants;
