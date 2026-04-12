-- ================================================================
-- Cost Centers, Profit Centers & GL Mappings
-- ================================================================

-- ── Cost Centers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  name_ar     TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost_centers_tenant" ON public.cost_centers FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- ── Profit Centers ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profit_centers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  name_ar     TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
ALTER TABLE public.profit_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profit_centers_tenant" ON public.profit_centers FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- ── GL Mappings ──────────────────────────────────────────────
-- Maps business events (service categories, expense types, payment methods)
-- to their debit/credit GL accounts + optional cost/profit center
CREATE TABLE IF NOT EXISTS public.gl_mappings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mapping_type     TEXT NOT NULL,  -- 'revenue_service' | 'revenue_product' | 'expense' | 'payment_method'
  source_key       TEXT NOT NULL,  -- e.g. 'hair','nails','cash','knet','rent' etc.
  label            TEXT,           -- human-readable label
  debit_account_id  UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  credit_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  cost_center_id   UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  profit_center_id UUID REFERENCES public.profit_centers(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, mapping_type, source_key)
);
ALTER TABLE public.gl_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gl_mappings_tenant" ON public.gl_mappings FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Indexes for fast lookup during auto-posting
CREATE INDEX IF NOT EXISTS idx_gl_mappings_lookup 
  ON public.gl_mappings(tenant_id, mapping_type, source_key);
CREATE INDEX IF NOT EXISTS idx_cost_centers_tenant  ON public.cost_centers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profit_centers_tenant ON public.profit_centers(tenant_id);
