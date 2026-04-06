-- ============================================================
-- Fix bookings RLS + online booking requests workflow
-- ============================================================

-- ── 1. Fix bookings SELECT policy ────────────────────────────
-- The old complex join policy was unreliable (no tenant_id column on bookings).
-- Simplest correct approach: scope by service_id belonging to the tenant.
-- Edge function inserts always set service_id → this always works.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant can read bookings" ON public.bookings;

CREATE POLICY "Tenant staff can read bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    -- Staff see bookings where the service belongs to their tenant
    service_id IN (
      SELECT s.id FROM public.services s
      WHERE s.tenant_id = public.get_user_tenant_id(auth.uid())
    )
    -- Fallback: bookings created by staff within same tenant via client
    OR client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.tenant_id = public.get_user_tenant_id(auth.uid())
    )
    OR is_super_admin(auth.uid())
  );

-- ── 2. Fix bookings INSERT policy ─────────────────────────────
-- Service role (edge functions) bypasses RLS.
-- For authenticated users (manual calendar booking), require role.
DROP POLICY IF EXISTS "Authorized tenant staff can create bookings" ON public.bookings;

CREATE POLICY "Authorized tenant staff can create bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'receptionist'::app_role)
    OR has_role(auth.uid(), 'cashier'::app_role)
    OR is_super_admin(auth.uid())
  );

-- ── 3. Fix bookings UPDATE policy ─────────────────────────────
DROP POLICY IF EXISTS "Authorized tenant staff can update bookings" ON public.bookings;

CREATE POLICY "Authorized tenant staff can update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    service_id IN (
      SELECT s.id FROM public.services s
      WHERE s.tenant_id = public.get_user_tenant_id(auth.uid())
    )
    OR client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.tenant_id = public.get_user_tenant_id(auth.uid())
    )
    OR is_super_admin(auth.uid())
  );

-- ── 4. Online booking requests notification log ───────────────
-- Track when admin was notified, response time, notes
CREATE TABLE IF NOT EXISTS public.online_booking_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_name     TEXT NOT NULL,
  client_phone    TEXT NOT NULL,
  service_name    TEXT NOT NULL,
  booking_date    DATE NOT NULL,
  start_time      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | declined
  admin_note      TEXT,
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_online_requests_tenant ON public.online_booking_requests(tenant_id, status, created_at DESC);

ALTER TABLE public.online_booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access online_booking_requests"
  ON public.online_booking_requests FOR ALL TO authenticated
  USING(
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  )
  WITH CHECK(
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  );
