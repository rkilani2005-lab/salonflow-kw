import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type PackageType = 'session' | 'bundle' | 'wallet' | 'membership' | 'unlimited';

export interface PackageItem {
  id?: string;
  service_id: string | null;
  quantity: number;
  service?: { name: string; price: number } | null;
}

export interface ServicePackage {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  package_type: PackageType;
  service_id: string | null;
  sessions_total: number | null;
  price: number;
  valid_days: number | null;
  is_active: boolean;
  color: string;
  credit_value: number | null;
  credit_bonus: number | null;
  billing_interval: 'weekly' | 'monthly' | 'yearly' | null;
  sessions_per_cycle: number | null;
  auto_renew: boolean;
  is_unlimited: boolean;
  created_at: string;
  service?: { name: string; duration: number; price: number } | null;
  items?: PackageItem[];
}

export interface ClientPackage {
  id: string;
  tenant_id: string;
  package_id: string;
  client_id: string;
  package_type: PackageType;
  sessions_total: number | null;
  sessions_used: number | null;
  sessions_remaining: number | null;
  is_unlimited: boolean;
  credit_total: number | null;
  credit_remaining: number | null;
  billing_interval: string | null;
  sessions_per_cycle: number | null;
  auto_renew: boolean;
  cycle_started_at: string | null;
  renews_at: string | null;
  purchase_date: string;
  expires_at: string | null;
  status: string;
  price_paid: number | null;
  notes: string | null;
  package?: ServicePackage;
  client?: { name: string; phone: string };
  client_items?: Array<{
    id: string; service_id: string | null; quantity_total: number; quantity_used: number;
    service?: { name: string } | null;
  }>;
}

export const useServicePackages = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['service-packages', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_packages')
        .select('*, service:service_id(name, duration, price), items:package_items(*, service:service_id(name, price))')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ServicePackage[];
    },
    enabled: !!tenant?.id,
  });
};

type SavePackageInput = Partial<ServicePackage> & { items?: PackageItem[] };

export const useCreateServicePackage = () => {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: SavePackageInput) => {
      const { items, service, id, tenant_id, created_at, sessions_remaining, ...row } = input as any;
      const { data: pkg, error } = await supabase.from('service_packages')
        .insert({ ...row, tenant_id: tenant!.id }).select().single();
      if (error) throw error;
      if (input.package_type === 'bundle' && items?.length) {
        const rows = items
          .filter((it: PackageItem) => it.service_id)
          .map((it: PackageItem) => ({
            tenant_id: tenant!.id, package_id: pkg.id, service_id: it.service_id, quantity: it.quantity,
          }));
        if (rows.length) {
          const { error: itErr } = await supabase.from('package_items').insert(rows);
          if (itErr) throw itErr;
        }
      }
      return pkg;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-packages'] });
      toast({ title: '✅ Package created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useUpdateServicePackage = () => {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: SavePackageInput & { id: string }) => {
      const { items, service, id, tenant_id, created_at, sessions_remaining, ...row } = input as any;
      const { error } = await supabase.from('service_packages').update(row).eq('id', id);
      if (error) throw error;
      if (input.package_type === 'bundle') {
        await supabase.from('package_items').delete().eq('package_id', id);
        const rows = (items || [])
          .filter((it: PackageItem) => it.service_id)
          .map((it: PackageItem) => ({
            tenant_id: tenant!.id, package_id: id, service_id: it.service_id, quantity: it.quantity,
          }));
        if (rows.length) {
          const { error: itErr } = await supabase.from('package_items').insert(rows);
          if (itErr) throw itErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-packages'] });
      toast({ title: '✅ Package updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useClientPackages = (clientId?: string | null) => {
  return useQuery({
    queryKey: ['client-packages', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_packages')
        .select('*, package:package_id(*, service:service_id(name,duration,price)), client_items:client_package_items(*, service:service_id(name))')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ClientPackage[];
    },
    enabled: !!clientId,
  });
};

export const useSellPackage = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      package_id: string;
      client_id: string;
      transaction_id?: string;
      notes?: string;
      payment_method?: string;
    }) => {
      const { data: cpId, error } = await supabase.rpc('sell_package', {
        p_package_id: input.package_id,
        p_client_id: input.client_id,
        p_transaction_id: input.transaction_id || null,
        p_notes: input.notes || null,
      });
      if (error) throw error;
      supabase.rpc('post_package_sale_to_gl', {
        p_client_package_id: cpId,
        p_payment_method: input.payment_method || 'cash',
      }).then(({ error: gErr }: any) => {
        if (gErr) console.warn('package sale GL posting failed:', gErr.message);
      });
      return cpId as string;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['client-packages', vars.client_id] });
      toast({ title: '✅ Package sold and activated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useRedeemPackageSession = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      client_package_id: string;
      client_id: string;
      service_id?: string | null;
      amount?: number | null;
      booking_id?: string;
      transaction_id?: string;
    }) => {
      const { error } = await supabase.rpc('redeem_package', {
        p_client_package_id: input.client_package_id,
        p_service_id: input.service_id || null,
        p_amount: input.amount ?? null,
        p_booking_id: input.booking_id || null,
        p_transaction_id: input.transaction_id || null,
      });
      if (error) throw error;
      supabase.rpc('post_package_redemption_to_gl', {
        p_client_package_id: input.client_package_id,
        p_service_id: input.service_id || null,
        p_amount: input.amount ?? null,
      }).then(({ error: gErr }: any) => {
        if (gErr) console.warn('package redemption GL posting failed:', gErr.message);
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['client-packages', vars.client_id] });
      toast({ title: '✅ Redeemed' });
    },
    onError: (e: any) => toast({ title: 'Cannot redeem', description: e.message, variant: 'destructive' }),
  });
};

export const usePackagesSoldThisMonth = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['packages-sold-month', tenant?.id],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data, error } = await supabase
        .from('client_packages')
        .select('price_paid, purchase_date, created_at')
        .eq('tenant_id', tenant!.id)
        .gte('created_at', monthStart);
      if (error) throw error;
      const rows = data || [];
      const total = rows.reduce((s: number, r: any) => s + Number(r.price_paid || 0), 0);
      return { count: rows.length, total };
    },
    enabled: !!tenant?.id,
  });
};

export const useDueRenewals = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['membership-renewals', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_renewals')
        .select('*, client_package:client_package_id(id, client_id, package:package_id(name), client:client_id(name, phone))')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'due')
        .order('cycle_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });
};

export const useResolveRenewal = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { id: string; status: 'collected' | 'waived'; transaction_id?: string }) => {
      const { error } = await supabase.from('membership_renewals').update({
        status: input.status,
        collected_at: new Date().toISOString(),
        transaction_id: input.transaction_id || null,
      }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['membership-renewals'] });
      toast({ title: '✅ Renewal updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};
