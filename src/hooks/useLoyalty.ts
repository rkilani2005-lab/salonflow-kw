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
  /** DB column: is_active.  Source of truth for whether the loyalty
   *  programme runs on this tenant.  Previous code read `is_enabled`,
   *  which does not exist on the row — every check returned undefined,
   *  so no points were ever awarded and the redemption UI never rendered. */
  is_active: boolean;
  /** Points earned per 1 currency unit of grand total.  e.g. 1.0 means
   *  1 point per KWD.  Whole points are floored at award time. */
  points_per_kwd: number;
  /** Optional per-type override: points per KWD spent on services.
   *  When null, server-side award_loyalty falls back to points_per_kwd. */
  points_per_kwd_service: number | null;
  /** Optional per-type override: points per KWD spent on products.
   *  When null, server-side award_loyalty falls back to points_per_kwd. */
  points_per_kwd_product: number | null;
  /** Currency value of 1 point.  e.g. 0.01 means 1 point = 0.010 KWD,
   *  so 100 points redeems for 1 KWD.  Previously referred to as
   *  kwd_per_point in code — that name does not exist in the schema. */
  redemption_rate: number;
  /** Minimum points balance required before redemption is allowed. */
  min_redemption: number;
  tier_vip_threshold: number | null;
  tier_vvip_threshold: number | null;
}

/** Redemption cap as a % of subtotal.  Not yet persisted in loyalty_config
 *  schema (no column exists), so applied as a compile-time constant until
 *  a migration adds it.  50% is a conservative default — stops a client
 *  from wiping an entire bill with accumulated points. */
export const MAX_REDEEM_PCT = 50;

export interface GiftCard {
  id: string;
  tenant_id: string;
  code: string;
  initial_balance: number;   // DB column: initial_balance
  current_balance: number;   // DB column: current_balance
  recipient_name: string | null;
  recipient_phone: string | null;
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
        .select('id, tenant_id, points_per_kwd, redemption_rate, min_redemption, tier_vip_threshold, tier_vvip_threshold, is_active')
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
        .select('id, client_id, type, points, balance_after, note, booking_id, created_at')
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
        .from('gift_cards').select('id, code, initial_balance, current_balance, recipient_name, recipient_phone, status, expires_at, created_at, tenant_id')
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
        tenant_id:       tenant!.id,
        code:            input.code.toUpperCase(),
        initial_balance: input.amount,   // correct DB column
        current_balance: input.amount,   // correct DB column
        recipient_name:  input.issued_to_name  || null,
        recipient_phone: input.issued_to_phone || null,
        expires_at:      input.expires_at || null,
        status:          'active',
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

// Validate + look up a gift card balance.
// Returns the row only when it has a positive current_balance and is
// not expired.  Earlier code selected loyalty_config columns from the
// gift_cards table (typo carry-over), which silently returned NaN at
// checkout. Fix: use the real schema (initial_balance / current_balance).
export const validateGiftCard = async (tenantId: string, code: string) => {
  const { data } = await supabase
    .from('gift_cards')
    .select('id, tenant_id, code, initial_balance, current_balance, status, expires_at')
    .eq('tenant_id', tenantId)
    .eq('code', code.toUpperCase().trim())
    .eq('status', 'active')
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  if (Number(data.current_balance) <= 0) return null;
  return data as GiftCard | null;
};

// ── Promo Codes ───────────────────────────────────────────────
export const usePromoCodes = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['promo-codes', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promo_codes').select('id, code, name, discount_type, discount_value, min_purchase, max_uses, used_count, is_active, expires_at, created_at, tenant_id')
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
