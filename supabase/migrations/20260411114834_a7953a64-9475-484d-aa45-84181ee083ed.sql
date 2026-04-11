
-- ── WhatsApp Enhancement ──────────────────────────────────────
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS phone_number_id        TEXT,
  ADD COLUMN IF NOT EXISTS waba_id                TEXT,
  ADD COLUMN IF NOT EXISTS access_token           TEXT,
  ADD COLUMN IF NOT EXISTS webhook_verify_token   TEXT DEFAULT 'zaina_webhook_' || gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS connection_status      TEXT DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS last_connected_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS business_name          TEXT,
  ADD COLUMN IF NOT EXISTS display_phone_number   TEXT;

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  template_name   TEXT,
  category        TEXT NOT NULL DEFAULT 'UTILITY',
  trigger_event   TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  body_en         TEXT NOT NULL,
  body_ar         TEXT,
  header_type     TEXT DEFAULT 'none',
  header_content  TEXT,
  footer_text     TEXT,
  buttons         JSONB DEFAULT '[]',
  variables       TEXT[] DEFAULT '{}',
  meta_status     TEXT DEFAULT 'local_only',
  meta_template_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant manages templates" ON public.whatsapp_templates FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.whatsapp_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  template_id     UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  is_enabled      BOOLEAN NOT NULL DEFAULT false,
  delay_minutes   INTEGER NOT NULL DEFAULT 0,
  target_audience TEXT NOT NULL DEFAULT 'client',
  conditions      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, event)
);

ALTER TABLE public.whatsapp_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant manages triggers" ON public.whatsapp_triggers FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- ── Settings Persistence ──────────────────────────────────────
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"emailNotif": true, "smsNotif": true, "bookingReminders": true, "marketingEmails": false}'::jsonb;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '{"sun": true, "mon": true, "tue": true, "wed": true, "thu": true, "fri": false, "sat": false}'::jsonb;

-- ── Client Portal Tokens ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_portal_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON public.client_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_client ON public.client_portal_tokens(client_id);

ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public token lookup" ON public.client_portal_tokens FOR SELECT USING (true);
CREATE POLICY "Service role inserts tokens" ON public.client_portal_tokens FOR INSERT WITH CHECK (true);

-- ── Online Booking Requests ───────────────────────────────────
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
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_online_requests_tenant ON public.online_booking_requests(tenant_id, status, created_at DESC);

ALTER TABLE public.online_booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access online_booking_requests" ON public.online_booking_requests FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- ── Performance Indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON public.bookings(booking_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON public.bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_staff ON public.bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service ON public.bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date ON public.transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_product ON public.inventory_transactions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON public.staff(tenant_id);
