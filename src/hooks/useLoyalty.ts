import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';

// Cast to any to support tables not yet reflected in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface LoyaltyConfig {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  points_per_kwd: number;
  kwd_per_point: number;
  min_redeem_points: number;
  max_redeem_pct: number;
}

export interface GiftCard {
  id: string;
  tenant_id: string;
  code: string;
  initial_amount: number;
  balance: number;
  issued_to_name: string | null;
  issued_to_phone: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

export interface PromoCode {
  id: string;
  tenant_id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
  max_discount_cap: number | null;
  usage_limit: number | null;
  usage_count: number;
  valid_from: string;
  valid_to: string | null;
  applies_to: string;
  is_active: boolean;
  created_at: string;
}

// ── Loyalty Config ────────────────────────────────────────────
export const useLoyaltyConfig = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['loyalty-config', tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('loyalty_config')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .maybeSingle();
      return data as LoyaltyConfig | null;
    },
    enabled: !!tenant?.id,
  });
};

export const useSaveLoyaltyConfig = () => {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (cfg: Partial<LoyaltyConfig>) => {
      const { data: existing } = await supabase
        .from('loyalty_config').select('id').eq('tenant_id', tenant!.id).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('loyalty_config').update(cfg).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('loyalty_config')
          .insert({ ...cfg, tenant_id: tenant!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-config'] });
      toast({ title: '✅ Loyalty settings saved' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── Client loyalty points ─────────────────────────────────────
export const useClientLoyalty = (clientId: string | null) => {
  return useQuery({
    queryKey: ['client-loyalty', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!clientId,
  });
};

// ── Gift Cards ────────────────────────────────────────────────
export const useGiftCards = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['gift-cards', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_cards').select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GiftCard[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateGiftCard = () => {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      code: string; amount: number; issued_to_name?: string;
      issued_to_phone?: string; expires_at?: string | null;
    }) => {
      const { error } = await supabase.from('gift_cards').insert({
        tenant_id:      tenant!.id,
        code:           input.code.toUpperCase(),
        initial_amount: input.amount,
        balance:        input.amount,
        issued_to_name: input.issued_to_name || null,
        issued_to_phone:input.issued_to_phone || null,
        expires_at:     input.expires_at || null,
        status:         'active',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gift-cards'] });
      toast({ title: '✅ Gift card created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// Validate + look up a gift card balance
export const validateGiftCard = async (tenantId: string, code: string) => {
  const { data } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .maybeSingle();
  return data as GiftCard | null;
};

// ── Promo Codes ───────────────────────────────────────────────
export const usePromoCodes = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['promo-codes', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promo_codes').select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PromoCode[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreatePromoCode = () => {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<PromoCode,'id'|'tenant_id'|'usage_count'|'created_at'>) => {
      const { error } = await supabase.from('promo_codes')
        .insert({ ...input, tenant_id: tenant!.id, code: input.code.toUpperCase() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo-codes'] });
      toast({ title: '✅ Promo code created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useUpdatePromoCode = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<PromoCode> & { id: string }) => {
      const { error } = await supabase.from('promo_codes').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo-codes'] });
      toast({ title: '✅ Promo code updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const validatePromoCode = async (tenantId: string, code: string, subtotal: number) => {
  const { data, error } = await supabase.rpc('validate_promo_code', {
    p_tenant_id: tenantId,
    p_code:      code,
    p_subtotal:  subtotal,
  });
  if (error) throw error;
  return data?.[0] || null;
};
