import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
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
      // Re-read the package at redemption time so expiry / depletion
      // checks reflect DB state, not whatever the caller last cached.
      // The UI guards these same conditions, but the mutation must be
      // independently safe — a race between two concurrent redemptions
      // (e.g. two reception terminals) can slip past a UI-only check.
      const { data: cp, error: fetchErr } = await supabase
        .from('client_packages')
        .select('sessions_used, sessions_total, status, expires_at')
        .eq('id', input.client_package_id)
        .single();
      if (fetchErr) throw fetchErr;

      // Guard 1 — already depleted
      if (cp.sessions_used >= cp.sessions_total || cp.status === 'depleted') {
        throw new Error('This package has no sessions remaining.');
      }
      // Guard 2 — expired
      if (cp.expires_at) {
        const today = new Date().toISOString().slice(0, 10);
        if (cp.expires_at < today) {
          throw new Error('This package has expired and cannot be redeemed.');
        }
      }
      // Guard 3 — cancelled / non-active (anything that isn't explicitly active)
      if (cp.status && cp.status !== 'active') {
        throw new Error(`Package is ${cp.status} and cannot be redeemed.`);
      }

      const newUsed = cp.sessions_used + 1;
      const isDepleted = newUsed >= cp.sessions_total;

      const { error: updErr } = await supabase.from('client_packages').update({
        sessions_used: newUsed,
        status: isDepleted ? 'depleted' : 'active',
      }).eq('id', input.client_package_id);
      if (updErr) throw updErr;

      // Log redemption (best-effort audit trail — don't revert the
      // counter if the audit insert fails, the counter is the truth).
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
    onError: (e: any) => toast({ title: 'Cannot redeem', description: e.message, variant: 'destructive' }),
  });
};
