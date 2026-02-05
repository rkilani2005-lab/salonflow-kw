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
import { Search, MoreHorizontal, Eye, Edit, Ban, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import TenantDetailDialog from '@/components/admin/TenantDetailDialog';

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

const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
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

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase())
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
        return <Badge className="bg-purple-500">AI</Badge>;
      case 'professional':
        return <Badge className="bg-blue-500">Professional</Badge>;
      case 'starter':
      default:
        return <Badge variant="secondary">Starter</Badge>;
    }
  };

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
        <h1 className="text-3xl font-bold">Tenant Management</h1>
        <p className="text-muted-foreground">View and manage all salon accounts</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Tenants</CardTitle>
              <CardDescription>{tenants.length} total tenants</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salon Name</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trial</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {tenant.logo_url ? (
                        <img
                          src={tenant.logo_url}
                          alt={tenant.name}
                          className="h-8 w-8 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {tenant.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tenant.onboarding_completed ? 'Onboarded' : 'Pending onboarding'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getPlanBadge(tenant.subscription_plan)}</TableCell>
                  <TableCell>
                    {tenant.is_active ? (
                      <Badge variant="outline" className="text-green-500 border-green-500">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-500 border-red-500">
                        Suspended
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {tenant.is_trial ? (
                      <div>
                        <Badge variant="secondary">Trial</Badge>
                        {tenant.trial_ends_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ends {format(new Date(tenant.trial_ends_at), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedTenant(tenant);
                          setDialogOpen(true);
                        }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleTenantStatus(tenant)}>
                          {tenant.is_active ? (
                            <>
                              <Ban className="h-4 w-4 mr-2" />
                              Suspend Tenant
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Activate Tenant
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
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
