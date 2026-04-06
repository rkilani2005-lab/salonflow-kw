import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ServicePackage {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  service_id: string | null;
  sessions_total: number;
  price: number;
  valid_days: number | null;
  is_active: boolean;
  color: string;
  created_at: string;
  service?: { name: string; duration: number; price: number } | null;
}

export interface ClientPackage {
  id: string;
  tenant_id: string;
  package_id: string;
  client_id: string;
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
  purchase_date: string;
  expires_at: string | null;
  status: string;
  notes: string | null;
  package?: ServicePackage;
  client?: { name: string; phone: string };
}

// ── Service Packages ──────────────────────────────────────────
export const useServicePackages = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['service-packages', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_packages')
        .select('*, service:service_id(name, duration, price)')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ServicePackage[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateServicePackage = () => {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<ServicePackage,'id'|'tenant_id'|'created_at'|'service'>) => {
      const { error } = await supabase.from('service_packages')
        .insert({ ...input, tenant_id: tenant!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-packages'] });
      toast({ title: '✅ Package created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useUpdateServicePackage = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ServicePackage> & { id: string }) => {
      const { error } = await supabase.from('service_packages').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-packages'] });
      toast({ title: '✅ Package updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── Client Packages ───────────────────────────────────────────
export const useClientPackages = (clientId?: string | null) => {
  return useQuery({
    queryKey: ['client-packages', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_packages')
        .select('*, package:package_id(*, service:service_id(name,duration,price))')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ClientPackage[];
    },
    enabled: !!clientId,
  });
};

export const useSellPackage = () => {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      package_id: string;
      client_id: string;
      sessions_total: number;
      valid_days: number | null;
      transaction_id?: string;
      notes?: string;
    }) => {
      const expiresAt = input.valid_days
        ? new Date(Date.now() + input.valid_days * 86400000).toISOString().slice(0, 10)
        : null;
      const { data, error } = await supabase.from('client_packages').insert({
        tenant_id:      tenant!.id,
        package_id:     input.package_id,
        client_id:      input.client_id,
        sessions_total: input.sessions_total,
        sessions_used:  0,
        purchase_date:  new Date().toISOString().slice(0, 10),
        expires_at:     expiresAt,
        status:         'active',
        transaction_id: input.transaction_id || null,
        notes:          input.notes || null,
      }).select().single();
      if (error) throw error;
      return data;
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
      booking_id?: string;
      transaction_id?: string;
    }) => {
      // Increment sessions_used
      const { data: cp, error: fetchErr } = await supabase
        .from('client_packages').select('sessions_used,sessions_total')
        .eq('id', input.client_package_id).single();
      if (fetchErr) throw fetchErr;

      const newUsed = cp.sessions_used + 1;
      const isDepleted = newUsed >= cp.sessions_total;

      const { error: updErr } = await supabase.from('client_packages').update({
        sessions_used: newUsed,
        status: isDepleted ? 'depleted' : 'active',
      }).eq('id', input.client_package_id);
      if (updErr) throw updErr;

      // Log redemption
      await supabase.from('package_redemptions').insert({
        client_package_id: input.client_package_id,
        booking_id:    input.booking_id || null,
        transaction_id: input.transaction_id || null,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['client-packages', vars.client_id] });
      toast({ title: '✅ Session redeemed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};
