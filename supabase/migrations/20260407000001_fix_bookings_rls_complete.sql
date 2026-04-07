-- ============================================================
-- COMPREHENSIVE FIX: Bookings RLS + Client Recognition
-- ============================================================

-- ── 1. Drop ALL existing booking policies (clean slate) ───────
DROP POLICY IF EXISTS "Anyone can create a booking"                ON public.bookings;
DROP POLICY IF EXISTS "Bookings are publicly readable"             ON public.bookings;
DROP POLICY IF EXISTS "Bookings can be updated"                    ON public.bookings;
DROP POLICY IF EXISTS "Service role full access to bookings"       ON public.bookings;
DROP POLICY IF EXISTS "Users can view bookings in their tenant"    ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings in their tenant"  ON public.bookings;
DROP POLICY IF EXISTS "Users can update bookings in their tenant"  ON public.bookings;
DROP POLICY IF EXISTS "Tenant can read bookings"                   ON public.bookings;
DROP POLICY IF EXISTS "Authorized tenant staff can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authorized tenant staff can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Tenant staff can read bookings"             ON public.bookings;

-- ── 2. New simple, reliable booking policies ──────────────────
-- bookings has NO tenant_id column — scoping is done via client_id → clients.tenant_id
-- OR via service_id → services.tenant_id (always set for online bookings)
-- Service role (edge functions) bypass RLS automatically.

-- SELECT: staff see bookings belonging to their tenant
CREATE POLICY "bookings_select"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    -- Service_id route (always set for online bookings)
    service_id IN (
      SELECT id FROM public.services
      WHERE tenant_id = public.get_user_tenant_id(auth.uid())
    )
    -- Client route (fallback for walk-ins without service_id)
    OR client_id IN (
      SELECT id FROM public.clients
      WHERE tenant_id = public.get_user_tenant_id(auth.uid())
    )
    -- Super admin sees all
    OR public.is_super_admin(auth.uid())
  );

-- INSERT: authenticated staff can create bookings (calendar/walk-in)
-- Service role bypasses this automatically (edge function online bookings)
CREATE POLICY "bookings_insert"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'receptionist'::app_role)
    OR public.has_role(auth.uid(), 'cashier'::app_role)
    OR public.is_super_admin(auth.uid())
  );

-- UPDATE: same scope as SELECT
CREATE POLICY "bookings_update"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    service_id IN (
      SELECT id FROM public.services
      WHERE tenant_id = public.get_user_tenant_id(auth.uid())
    )
    OR client_id IN (
      SELECT id FROM public.clients
      WHERE tenant_id = public.get_user_tenant_id(auth.uid())
    )
    OR public.is_super_admin(auth.uid())
  );

-- ── 3. Fix clients with NULL tenant_id ───────────────────────
-- Clients created via the online booking page before our RLS fix
-- may have NULL tenant_id. Update them using the service_id from their bookings.
UPDATE public.clients c
SET tenant_id = (
  SELECT s.tenant_id
  FROM public.bookings b
  JOIN public.services s ON s.id = b.service_id
  WHERE b.client_id = c.id
    AND s.tenant_id IS NOT NULL
  LIMIT 1
)
WHERE c.tenant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.services s ON s.id = b.service_id
    WHERE b.client_id = c.id AND s.tenant_id IS NOT NULL
  );

-- ── 4. Drop all existing client policies (clean slate) ────────
DROP POLICY IF EXISTS "Anyone can create a client"        ON public.clients;
DROP POLICY IF EXISTS "Clients are publicly readable"     ON public.clients;
DROP POLICY IF EXISTS "Service role can manage clients"   ON public.clients;
DROP POLICY IF EXISTS "Tenant staff can read their clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant staff can insert clients"   ON public.clients;
DROP POLICY IF EXISTS "Tenant staff can update clients"   ON public.clients;

-- ── 5. New client policies ────────────────────────────────────
CREATE POLICY "clients_select"
  ON public.clients FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "clients_insert"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "clients_update"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- ── 6. Ensure online_booking_requests exists safely ──────────
CREATE TABLE IF NOT EXISTS public.online_booking_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_name     TEXT NOT NULL,
  client_phone    TEXT NOT NULL,
  service_name    TEXT NOT NULL,
  booking_date    DATE NOT NULL,
  start_time      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  admin_note      TEXT,
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_online_requests_tenant
  ON public.online_booking_requests(tenant_id, status, created_at DESC);

-- Ensure RLS + policy
ALTER TABLE public.online_booking_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant access online_booking_requests" ON public.online_booking_requests;
CREATE POLICY "online_requests_all"
  ON public.online_booking_requests FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );
