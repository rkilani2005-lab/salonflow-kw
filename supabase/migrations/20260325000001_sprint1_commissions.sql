-- ============================================================
-- Sprint 1: Staff Commissions
-- ============================================================

-- Commission structure: owner sets a rate (% or flat KWD) 
-- per staff member, optionally overriding per service category
CREATE TABLE public.staff_commission_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id      UUID NOT NULL REFERENCES public.staff(id)  ON DELETE CASCADE,
  -- NULL service_category = applies to all services (default rate)
  service_category  TEXT,   -- hair | nails | facial | makeup | waxing | massage | other
  commission_type   TEXT NOT NULL DEFAULT 'percentage',  -- percentage | flat
  commission_value  NUMERIC(10,3) NOT NULL DEFAULT 0,    -- % or KWD amount
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, service_category)
);

-- Earned commissions: one row per transaction_item where a commission applies
CREATE TABLE public.staff_commission_earnings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id            UUID NOT NULL REFERENCES public.staff(id),
  transaction_id      UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  transaction_item_id UUID REFERENCES public.transaction_items(id) ON DELETE CASCADE,
  rule_id             UUID REFERENCES public.staff_commission_rules(id),
  service_name        TEXT NOT NULL,
  sale_amount         NUMERIC(10,3) NOT NULL,
  commission_type     TEXT NOT NULL,
  commission_rate     NUMERIC(10,3) NOT NULL,
  commission_amount   NUMERIC(10,3) NOT NULL,
  payout_status       TEXT NOT NULL DEFAULT 'pending', -- pending | paid | voided
  payout_date         DATE,
  payout_reference    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_rules_staff   ON public.staff_commission_rules(staff_id);
CREATE INDEX idx_commission_rules_tenant  ON public.staff_commission_rules(tenant_id);
CREATE INDEX idx_commission_earn_staff    ON public.staff_commission_earnings(staff_id, payout_status);
CREATE INDEX idx_commission_earn_txn      ON public.staff_commission_earnings(transaction_id);
CREATE INDEX idx_commission_earn_tenant   ON public.staff_commission_earnings(tenant_id, created_at DESC);

ALTER TABLE public.staff_commission_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_commission_earnings  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access to commission_rules"
ON public.staff_commission_rules FOR ALL TO authenticated
USING   (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=staff_commission_rules.tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=staff_commission_rules.tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant access to commission_earnings"
ON public.staff_commission_earnings FOR ALL TO authenticated
USING   (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=staff_commission_earnings.tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=staff_commission_earnings.tenant_id) OR is_super_admin(auth.uid()));

CREATE TRIGGER update_commission_rules_updated_at
  BEFORE UPDATE ON public.staff_commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: resolve commission for a staff member + service category
CREATE OR REPLACE FUNCTION public.get_commission_rate(
  p_staff_id UUID,
  p_category TEXT
)
RETURNS TABLE(rule_id UUID, commission_type TEXT, commission_value NUMERIC)
LANGUAGE sql STABLE AS $$
  -- Category-specific rule takes precedence over default (NULL category)
  SELECT id, commission_type, commission_value
  FROM public.staff_commission_rules
  WHERE staff_id = p_staff_id AND is_active = true
    AND (service_category = p_category OR service_category IS NULL)
  ORDER BY service_category NULLS LAST  -- specific before default
  LIMIT 1;
$$;
