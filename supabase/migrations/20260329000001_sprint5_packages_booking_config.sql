-- ============================================================
-- Sprint 5: Service Packages + Online Booking Config
-- ============================================================

-- ── 1. Service Packages ───────────────────────────────────────
-- A package is a pre-paid bundle of sessions sold at a discount
CREATE TABLE public.service_packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  name_ar           TEXT,
  description       TEXT,
  service_id        UUID REFERENCES public.services(id) ON DELETE CASCADE,
  sessions_total    INTEGER NOT NULL DEFAULT 5,     -- e.g. 5 sessions
  price             NUMERIC(10,3) NOT NULL,          -- package price (discounted)
  valid_days        INTEGER,                          -- NULL = never expires
  is_active         BOOLEAN NOT NULL DEFAULT true,
  color             TEXT DEFAULT '#C0395E',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sold packages (one row per client purchase)
CREATE TABLE public.client_packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id        UUID NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  transaction_id    UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  sessions_total    INTEGER NOT NULL,
  sessions_used     INTEGER NOT NULL DEFAULT 0,
  sessions_remaining INTEGER GENERATED ALWAYS AS (sessions_total - sessions_used) STORED,
  purchase_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at        DATE,
  status            TEXT NOT NULL DEFAULT 'active', -- active | depleted | expired | voided
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Redemption log (each time a session is used)
CREATE TABLE public.package_redemptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_package_id UUID NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
  booking_id        UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  transaction_id    UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  redeemed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_by       UUID REFERENCES auth.users(id),
  notes             TEXT
);

CREATE INDEX idx_packages_tenant   ON public.service_packages(tenant_id, is_active);
CREATE INDEX idx_client_pkgs_client ON public.client_packages(client_id, status);
CREATE INDEX idx_client_pkgs_tenant ON public.client_packages(tenant_id, status);

ALTER TABLE public.service_packages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_packages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access service_packages"
  ON public.service_packages FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=service_packages.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=service_packages.tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant access client_packages"
  ON public.client_packages FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=client_packages.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=client_packages.tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant access package_redemptions"
  ON public.package_redemptions FOR ALL TO authenticated
  USING(EXISTS(
    SELECT 1 FROM public.client_packages cp
    JOIN public.profiles p ON p.tenant_id=cp.tenant_id
    WHERE cp.id=package_redemptions.client_package_id AND p.user_id=auth.uid()
  ) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(
    SELECT 1 FROM public.client_packages cp
    JOIN public.profiles p ON p.tenant_id=cp.tenant_id
    WHERE cp.id=package_redemptions.client_package_id AND p.user_id=auth.uid()
  ) OR is_super_admin(auth.uid()));

CREATE TRIGGER update_service_packages_updated_at
  BEFORE UPDATE ON public.service_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. Online Booking Configuration ──────────────────────────
CREATE TABLE public.booking_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_enabled          BOOLEAN NOT NULL DEFAULT true,
  slug                TEXT UNIQUE,                   -- vanity URL: /book/my-salon
  header_title        TEXT,
  header_title_ar     TEXT,
  welcome_msg         TEXT,
  welcome_msg_ar      TEXT,
  require_deposit     BOOLEAN NOT NULL DEFAULT false, -- force deposit for all services
  deposit_pct         NUMERIC(5,2) DEFAULT 25,        -- % of service price if no fixed amount
  advance_booking_days INTEGER NOT NULL DEFAULT 30,   -- how far ahead clients can book
  min_notice_hours    INTEGER NOT NULL DEFAULT 2,     -- min hours before appointment
  allow_cancellation  BOOLEAN NOT NULL DEFAULT true,
  cancellation_hours  INTEGER NOT NULL DEFAULT 24,    -- hours before appt to allow free cancel
  show_prices         BOOLEAN NOT NULL DEFAULT true,
  show_staff          BOOLEAN NOT NULL DEFAULT true,
  primary_color       TEXT DEFAULT '#C0395E',
  custom_css          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_config_slug ON public.booking_config(slug);

ALTER TABLE public.booking_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access booking_config"
  ON public.booking_config FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=booking_config.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=booking_config.tenant_id) OR is_super_admin(auth.uid()));

-- Public read for the booking page (no auth required)
CREATE POLICY "Public read booking_config"
  ON public.booking_config FOR SELECT USING(is_enabled = true);

CREATE TRIGGER update_booking_config_updated_at
  BEFORE UPDATE ON public.booking_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
