-- =====================================================================
-- Workflow Upgrades — Phase 2
-- =====================================================================

-- 1.1  Multi-stylist commission split per transaction item
CREATE TABLE IF NOT EXISTS public.transaction_item_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_item_id UUID NOT NULL REFERENCES public.transaction_items(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  allocation_percent NUMERIC(5,2) NOT NULL CHECK (allocation_percent > 0 AND allocation_percent <= 100),
  role_in_service TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transaction_item_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users view item staff" ON public.transaction_item_staff FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.transaction_items ti
          JOIN public.transactions t ON t.id = ti.transaction_id
          WHERE ti.id = transaction_item_staff.transaction_item_id
            AND (t.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())))
);
CREATE POLICY "Authorized staff insert item staff" ON public.transaction_item_staff FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.transaction_items ti
          JOIN public.transactions t ON t.id = ti.transaction_id
          WHERE ti.id = transaction_item_staff.transaction_item_id
            AND t.tenant_id = get_user_tenant_id(auth.uid()))
);
CREATE POLICY "Authorized staff update item staff" ON public.transaction_item_staff FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.transaction_items ti
          JOIN public.transactions t ON t.id = ti.transaction_id
          WHERE ti.id = transaction_item_staff.transaction_item_id
            AND t.tenant_id = get_user_tenant_id(auth.uid()))
);
CREATE POLICY "Authorized staff delete item staff" ON public.transaction_item_staff FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.transaction_items ti
          JOIN public.transactions t ON t.id = ti.transaction_id
          WHERE ti.id = transaction_item_staff.transaction_item_id
            AND t.tenant_id = get_user_tenant_id(auth.uid()))
);

CREATE INDEX IF NOT EXISTS idx_transaction_item_staff_item ON public.transaction_item_staff(transaction_item_id);
CREATE INDEX IF NOT EXISTS idx_transaction_item_staff_staff ON public.transaction_item_staff(staff_id);

-- 1.2  Tip allocations per transaction
CREATE TABLE IF NOT EXISTS public.transaction_tip_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  amount NUMERIC(12,3) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transaction_tip_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users view tips" ON public.transaction_tip_allocations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_tip_allocations.transaction_id
          AND (t.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())))
);
CREATE POLICY "Authorized staff insert tips" ON public.transaction_tip_allocations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_tip_allocations.transaction_id
          AND t.tenant_id = get_user_tenant_id(auth.uid()))
);
CREATE POLICY "Authorized staff update tips" ON public.transaction_tip_allocations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_tip_allocations.transaction_id
          AND t.tenant_id = get_user_tenant_id(auth.uid()))
);
CREATE POLICY "Authorized staff delete tips" ON public.transaction_tip_allocations FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_tip_allocations.transaction_id
          AND t.tenant_id = get_user_tenant_id(auth.uid()))
);

CREATE INDEX IF NOT EXISTS idx_tip_alloc_transaction ON public.transaction_tip_allocations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tip_alloc_staff ON public.transaction_tip_allocations(staff_id);

-- 1.3  Daily briefing config (one row per tenant)
CREATE TABLE IF NOT EXISTS public.daily_briefing_config (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  send_hour INTEGER NOT NULL DEFAULT 9 CHECK (send_hour >= 0 AND send_hour <= 23),
  recipient_phone TEXT,
  last_sent_date DATE,
  last_brief TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_briefing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users view briefing config" ON public.daily_briefing_config FOR SELECT USING (
  tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
);
CREATE POLICY "Managers insert briefing config" ON public.daily_briefing_config FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);
CREATE POLICY "Managers update briefing config" ON public.daily_briefing_config FOR UPDATE USING (
  tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- 1.4  Service actual usage capture
CREATE TABLE IF NOT EXISTS public.service_actual_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  expected_qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  actual_qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  variance NUMERIC(12,3) GENERATED ALWAYS AS (actual_qty - expected_qty) STORED,
  variance_pct NUMERIC(8,2) GENERATED ALWAYS AS (
    CASE WHEN expected_qty > 0 THEN ((actual_qty - expected_qty) / expected_qty) * 100 ELSE 0 END
  ) STORED,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
ALTER TABLE public.service_actual_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users view actual usage" ON public.service_actual_usage FOR SELECT USING (
  tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
);
CREATE POLICY "Authorized staff insert actual usage" ON public.service_actual_usage FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
);
CREATE POLICY "Authorized staff update actual usage" ON public.service_actual_usage FOR UPDATE USING (
  tenant_id = get_user_tenant_id(auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_actual_usage_booking ON public.service_actual_usage(booking_id);
CREATE INDEX IF NOT EXISTS idx_actual_usage_tenant_date ON public.service_actual_usage(tenant_id, recorded_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_actual_usage_booking_product ON public.service_actual_usage(booking_id, product_id);

-- 1.5  Variance alert view — products with >20% deviation in the last 7 days
CREATE OR REPLACE VIEW public.usage_variance_v1 AS
SELECT
  sau.tenant_id,
  sau.product_id,
  p.name AS product_name,
  COUNT(*)                      AS captures,
  SUM(sau.expected_qty)         AS total_expected,
  SUM(sau.actual_qty)           AS total_actual,
  SUM(sau.actual_qty - sau.expected_qty) AS total_variance,
  CASE WHEN SUM(sau.expected_qty) > 0
       THEN (SUM(sau.actual_qty - sau.expected_qty) / SUM(sau.expected_qty)) * 100
       ELSE 0 END AS variance_pct
FROM public.service_actual_usage sau
JOIN public.products p ON p.id = sau.product_id
WHERE sau.recorded_at >= now() - interval '7 days'
GROUP BY sau.tenant_id, sau.product_id, p.name
HAVING ABS(
  CASE WHEN SUM(sau.expected_qty) > 0
       THEN (SUM(sau.actual_qty - sau.expected_qty) / SUM(sau.expected_qty)) * 100
       ELSE 0 END
) > 20;

-- 1.6  Customer self-check-in token
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS check_in_token TEXT UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '');
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_check_in_token ON public.bookings(check_in_token);

-- Backfill tokens for existing rows (the DEFAULT applies to inserts only)
UPDATE public.bookings SET check_in_token = replace(gen_random_uuid()::text, '-', '')
  WHERE check_in_token IS NULL;

COMMENT ON COLUMN public.bookings.check_in_token IS
  'Random opaque token used as the public check-in URL slug.';