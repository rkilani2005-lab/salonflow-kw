// src/hooks/useEntitlements.ts
// Plan + feature gating hook. Reads tenant_subscriptions + subscription_plans
// directly (RLS-scoped). Falls back to trial entitlements while no paid
// subscription exists.
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type EntitlementStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

export interface Entitlements {
  plan_code: string;
  plan_name?: string;
  features: Record<string, any>;
  seat_limit: number | null;
  status: EntitlementStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  has: (feature: string) => boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT: Entitlements = {
  plan_code: 'starter',
  features: {},
  seat_limit: null,
  status: 'trialing',
  trial_ends_at: null,
  current_period_end: null,
  has: () => false,
  loading: true,
  refresh: async () => {},
};

export function useEntitlements(): Entitlements {
  const { tenant } = useAuth();
  const [state, setState] = useState<Entitlements>(DEFAULT);

  const fetchAll = useCallback(async () => {
    if (!tenant?.id) { setState(s => ({ ...s, loading: false })); return; }
    const [{ data: sub }, plansRes] = await Promise.all([
      (supabase as any).from('tenant_subscriptions')
        .select('plan_code,status,current_period_end,cancel_at_period_end')
        .eq('tenant_id', tenant.id).maybeSingle(),
      (supabase as any).from('subscription_plans').select('*').eq('is_active', true),
    ]);
    const plans = (plansRes?.data ?? []) as any[];
    const planCode = sub?.plan_code || tenant.subscription_plan || 'starter';
    const plan = plans.find(p => p.code === planCode);
    const trialActive = !!(tenant.is_trial && tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date());
    const subActive = sub?.status === 'active' && sub?.current_period_end && new Date(sub.current_period_end) > new Date();
    const status: EntitlementStatus = subActive ? 'active' : (trialActive ? 'trialing' : (sub?.status as EntitlementStatus || 'expired'));
    const features = plan?.features || {};
    setState({
      plan_code: planCode,
      plan_name: plan?.name,
      features,
      seat_limit: plan?.seat_limit ?? null,
      status,
      trial_ends_at: tenant.trial_ends_at ?? null,
      current_period_end: sub?.current_period_end ?? null,
      has: (f: string) => {
        // Trial unlocks everything
        if (status === 'trialing') return true;
        if (status !== 'active') return false;
        return !!features?.[f];
      },
      loading: false,
      refresh: fetchAll,
    });
  }, [tenant?.id, tenant?.subscription_plan, tenant?.trial_ends_at, tenant?.is_trial]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return state;
}
