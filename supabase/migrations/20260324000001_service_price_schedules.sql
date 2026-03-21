-- ============================================================
-- Service Price Schedules
-- Allows setting time-windowed prices per service
-- e.g. "Eid special: 15 KWD from Dec 24 09:00 to Jan 2 23:59"
-- ============================================================

CREATE TABLE public.service_price_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  label       TEXT NOT NULL,                -- "Weekend rate", "Eid special", etc.
  price       NUMERIC(10,3) NOT NULL,
  valid_from  TIMESTAMPTZ NOT NULL,         -- start of price window
  valid_to    TIMESTAMPTZ NOT NULL,         -- end of price window
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT  valid_window CHECK (valid_to > valid_from)
);

CREATE INDEX idx_price_schedules_service ON public.service_price_schedules(service_id, is_active);
CREATE INDEX idx_price_schedules_tenant  ON public.service_price_schedules(tenant_id);
CREATE INDEX idx_price_schedules_window  ON public.service_price_schedules(valid_from, valid_to);

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

-- Function: get the effective price for a service at a given timestamp
-- Returns the scheduled price if an active window covers that time,
-- otherwise returns the base price from services.price
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

CREATE TRIGGER update_service_price_schedules_updated_at
  BEFORE UPDATE ON public.service_price_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
