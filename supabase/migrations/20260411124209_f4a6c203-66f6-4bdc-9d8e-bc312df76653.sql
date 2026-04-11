
-- ============================================================
-- 1. tenant_invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'receptionist',
  status        TEXT NOT NULL DEFAULT 'pending',
  invited_by    UUID REFERENCES auth.users(id),
  token         UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '72 hours',
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON public.tenant_invitations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_token  ON public.tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email  ON public.tenant_invitations(email);

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view invitations"
ON public.tenant_invitations FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tenant_id = tenant_invitations.tenant_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Owners and managers can manage invitations"
ON public.tenant_invitations FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid()
    AND r.tenant_id = tenant_invitations.tenant_id
    AND r.role IN ('owner','manager')
  )
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid()
    AND r.tenant_id = tenant_invitations.tenant_id
    AND r.role IN ('owner','manager')
  )
  OR is_super_admin(auth.uid())
);

-- ============================================================
-- 2. service_price_schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_price_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  label       TEXT NOT NULL,
  price       NUMERIC(10,3) NOT NULL,
  valid_from  TIMESTAMPTZ NOT NULL,
  valid_to    TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_schedules_service ON public.service_price_schedules(service_id, is_active);
CREATE INDEX IF NOT EXISTS idx_price_schedules_tenant  ON public.service_price_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_price_schedules_window  ON public.service_price_schedules(valid_from, valid_to);

ALTER TABLE public.service_price_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access to price schedules"
ON public.service_price_schedules FOR ALL TO authenticated
USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tenant_id = service_price_schedules.tenant_id)
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tenant_id = service_price_schedules.tenant_id)
  OR is_super_admin(auth.uid())
);

CREATE OR REPLACE TRIGGER update_service_price_schedules_updated_at
  BEFORE UPDATE ON public.service_price_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. reorder_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reorder_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_stock   NUMERIC NOT NULL,
  reorder_point   NUMERIC NOT NULL,
  auto_po_id      UUID REFERENCES public.purchase_orders(id),
  status          TEXT NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reorder_alerts_unique ON public.reorder_alerts(product_id, status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_reorder_alerts_tenant ON public.reorder_alerts(tenant_id, status);

ALTER TABLE public.reorder_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access reorder_alerts"
  ON public.reorder_alerts FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=reorder_alerts.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=reorder_alerts.tenant_id) OR is_super_admin(auth.uid()));

-- ============================================================
-- 4. waiting_list
-- ============================================================
CREATE TABLE IF NOT EXISTS public.waiting_list (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name     TEXT NOT NULL,
  client_phone    TEXT NOT NULL,
  service_id      UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name    TEXT NOT NULL,
  staff_id        UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  preferred_date  DATE,
  preferred_time  TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'waiting',
  notified_at     TIMESTAMPTZ,
  booked_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_tenant ON public.waiting_list(tenant_id, status, preferred_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_date   ON public.waiting_list(tenant_id, preferred_date);

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access waiting_list"
  ON public.waiting_list FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=waiting_list.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=waiting_list.tenant_id) OR is_super_admin(auth.uid()));

CREATE OR REPLACE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON public.waiting_list
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. Missing functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_plan_user_limit(p_plan TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_plan
    WHEN 'starter'      THEN 3
    WHEN 'professional' THEN 10
    WHEN 'ai'           THEN 9999
    ELSE 3
  END;
$$;

CREATE OR REPLACE FUNCTION public.count_tenant_users(p_tenant_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(DISTINCT user_id)::INTEGER
  FROM public.user_roles
  WHERE tenant_id = p_tenant_id
  AND role != 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.get_effective_price(
  p_service_id UUID,
  p_at         TIMESTAMPTZ DEFAULT now()
)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (
      SELECT sps.price
      FROM public.service_price_schedules sps
      WHERE sps.service_id = p_service_id
        AND sps.is_active = true
        AND p_at >= sps.valid_from
        AND p_at < sps.valid_to
      ORDER BY sps.valid_from DESC
      LIMIT 1
    ),
    (SELECT price FROM public.services WHERE id = p_service_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_hours_worked(
  p_clock_in    TIMESTAMPTZ,
  p_clock_out   TIMESTAMPTZ,
  p_break_min   INTEGER DEFAULT 0
) RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_clock_in IS NULL OR p_clock_out IS NULL THEN 0
    ELSE GREATEST(0, ROUND(
      (EXTRACT(EPOCH FROM (p_clock_out - p_clock_in)) / 3600.0) - (p_break_min / 60.0),
      2
    ))
  END;
$$;

CREATE OR REPLACE FUNCTION public.validate_promo_code(
  p_tenant_id UUID,
  p_code      TEXT,
  p_subtotal  NUMERIC
)
RETURNS TABLE(
  promo_id UUID,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC,
  promo_name TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
  v_discount NUMERIC;
BEGIN
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE tenant_id = p_tenant_id
    AND code = UPPER(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
    AND (max_uses IS NULL OR used_count < max_uses);

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_subtotal < COALESCE(v_promo.min_purchase, 0) THEN
    RETURN;
  END IF;

  IF v_promo.discount_type = 'percentage' THEN
    v_discount := ROUND(p_subtotal * v_promo.discount_value / 100, 3);
  ELSE
    v_discount := v_promo.discount_value;
  END IF;

  RETURN QUERY SELECT
    v_promo.id,
    v_promo.discount_type,
    v_promo.discount_value,
    v_discount,
    v_promo.name;
END;
$$;

-- Add attendance trigger for updated_at if missing
CREATE OR REPLACE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
