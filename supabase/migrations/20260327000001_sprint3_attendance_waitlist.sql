-- ============================================================
-- Sprint 3: Staff Attendance + Waiting List
-- ============================================================

-- ── 1. Reorder alerts (auto-created by trigger) ───────────────
CREATE TABLE public.reorder_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_stock   NUMERIC NOT NULL,
  reorder_point   NUMERIC NOT NULL,
  auto_po_id      UUID REFERENCES public.purchase_orders(id),
  status          TEXT NOT NULL DEFAULT 'open', -- open | po_created | resolved | dismissed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  UNIQUE(product_id, status) -- one open alert per product
);

CREATE INDEX idx_reorder_alerts_tenant ON public.reorder_alerts(tenant_id, status);

ALTER TABLE public.reorder_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access reorder_alerts"
  ON public.reorder_alerts FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=reorder_alerts.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=reorder_alerts.tenant_id) OR is_super_admin(auth.uid()));

-- ── 2. Staff Attendance ───────────────────────────────────────
CREATE TABLE public.staff_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  work_date       DATE NOT NULL,
  clock_in        TIMESTAMPTZ,
  clock_out       TIMESTAMPTZ,
  break_minutes   INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'present', -- present | absent | late | half_day | day_off
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, work_date)
);

CREATE INDEX idx_attendance_staff  ON public.staff_attendance(staff_id, work_date DESC);
CREATE INDEX idx_attendance_tenant ON public.staff_attendance(tenant_id, work_date DESC);
CREATE INDEX idx_attendance_date   ON public.staff_attendance(tenant_id, work_date);

ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access attendance"
  ON public.staff_attendance FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=staff_attendance.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=staff_attendance.tenant_id) OR is_super_admin(auth.uid()));

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: compute hours worked for an attendance record
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

-- ── 3. Waiting List ───────────────────────────────────────────
CREATE TABLE public.waiting_list (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name     TEXT NOT NULL,
  client_phone    TEXT NOT NULL,
  service_id      UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name    TEXT NOT NULL,
  staff_id        UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  preferred_date  DATE,
  preferred_time  TEXT,            -- HH:MM
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'waiting', -- waiting | notified | booked | expired | cancelled
  notified_at     TIMESTAMPTZ,
  booked_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_tenant ON public.waiting_list(tenant_id, status, preferred_date);
CREATE INDEX idx_waitlist_date   ON public.waiting_list(tenant_id, preferred_date);

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access waiting_list"
  ON public.waiting_list FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=waiting_list.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=waiting_list.tenant_id) OR is_super_admin(auth.uid()));

CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON public.waiting_list
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
