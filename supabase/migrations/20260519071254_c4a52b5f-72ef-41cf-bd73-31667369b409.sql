-- Workflow Upgrades — Phase 2 (items 4, 5, 6, 7, 9, 10)

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS rebook_after_days INTEGER;

COMMENT ON COLUMN public.services.rebook_after_days IS
  'Optional. If set (e.g. 42 for color), the scheduler sends a rebook reminder this many days after the last completed booking for this service when the client has no future booking.';

CREATE TABLE IF NOT EXISTS public.client_trigger_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL,
  reference_id  UUID,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel      TEXT NOT NULL DEFAULT 'whatsapp',
  status       TEXT NOT NULL DEFAULT 'sent',
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_client_trigger_log_dedupe
  ON public.client_trigger_log (tenant_id, client_id, trigger_event, sent_at DESC);

ALTER TABLE public.client_trigger_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_trigger_log_select ON public.client_trigger_log;
CREATE POLICY client_trigger_log_select ON public.client_trigger_log
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.transaction_tips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  amount          NUMERIC(10,3) NOT NULL CHECK (amount >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_tips_txn   ON public.transaction_tips (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tips_staff ON public.transaction_tips (staff_id, created_at DESC);

ALTER TABLE public.transaction_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transaction_tips_select ON public.transaction_tips;
CREATE POLICY transaction_tips_select ON public.transaction_tips
  FOR SELECT TO authenticated
  USING (transaction_id IN (SELECT id FROM public.transactions
    WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS transaction_tips_insert ON public.transaction_tips;
CREATE POLICY transaction_tips_insert ON public.transaction_tips
  FOR INSERT TO authenticated
  WITH CHECK (transaction_id IN (SELECT id FROM public.transactions
    WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE OR REPLACE VIEW public.transaction_tip_rollup_v1 AS
SELECT tt.transaction_id, tt.staff_id, s.name AS staff_name, SUM(tt.amount) AS tip_total
FROM public.transaction_tips tt
JOIN public.staff s ON s.id = tt.staff_id
GROUP BY tt.transaction_id, tt.staff_id, s.name;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS owner_whatsapp     TEXT,
  ADD COLUMN IF NOT EXISTS daily_briefing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS daily_briefing_hour    INTEGER NOT NULL DEFAULT 8
    CHECK (daily_briefing_hour BETWEEN 0 AND 23);

CREATE TABLE IF NOT EXISTS public.owner_briefing_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary_text TEXT,
  metrics_json JSONB,
  status      TEXT NOT NULL DEFAULT 'sent',
  UNIQUE (tenant_id, briefing_date)
);

ALTER TABLE public.owner_briefing_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_briefing_log_select ON public.owner_briefing_log;
CREATE POLICY owner_briefing_log_select ON public.owner_briefing_log
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.service_consumption_actuals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  booking_id      UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  staff_id        UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  expected_qty    NUMERIC(10,3),
  actual_qty      NUMERIC(10,3) NOT NULL CHECK (actual_qty >= 0),
  notes           TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_consumption_actuals_booking  ON public.service_consumption_actuals (booking_id);
CREATE INDEX IF NOT EXISTS idx_consumption_actuals_variance ON public.service_consumption_actuals (tenant_id, recorded_at DESC);

ALTER TABLE public.service_consumption_actuals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sca_select ON public.service_consumption_actuals;
CREATE POLICY sca_select ON public.service_consumption_actuals
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS sca_insert ON public.service_consumption_actuals;
CREATE POLICY sca_insert ON public.service_consumption_actuals
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS sca_update ON public.service_consumption_actuals;
CREATE POLICY sca_update ON public.service_consumption_actuals
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS sca_delete ON public.service_consumption_actuals;
CREATE POLICY sca_delete ON public.service_consumption_actuals
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE OR REPLACE VIEW public.consumption_variance_v1 AS
SELECT
  sca.id, sca.tenant_id, sca.booking_id, sca.service_id,
  svc.name AS service_name, sca.product_id, p.name AS product_name,
  p.usage_unit AS unit_of_measure, sca.staff_id, st.name AS staff_name,
  sca.expected_qty, sca.actual_qty,
  CASE
    WHEN sca.expected_qty IS NULL OR sca.expected_qty = 0 THEN NULL
    ELSE ROUND(((sca.actual_qty - sca.expected_qty) / sca.expected_qty) * 100, 1)
  END AS variance_pct,
  sca.recorded_at
FROM public.service_consumption_actuals sca
LEFT JOIN public.services svc ON svc.id = sca.service_id
LEFT JOIN public.products p   ON p.id   = sca.product_id
LEFT JOIN public.staff st     ON st.id  = sca.staff_id;