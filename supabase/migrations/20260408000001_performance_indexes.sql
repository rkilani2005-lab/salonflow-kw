-- ============================================================
-- Performance Indexes — Audit P1 Fixes
-- ============================================================

-- ── bookings ─────────────────────────────────────────────────
-- client_id: used by client portal history + booking lookups
CREATE INDEX IF NOT EXISTS idx_bookings_client
  ON public.bookings(client_id);

-- is_online_booking: BookingRequests page full-table scan
CREATE INDEX IF NOT EXISTS idx_bookings_online
  ON public.bookings(is_online_booking, status)
  WHERE is_online_booking = true;

-- booking_date+status: Dashboard "today's appointments" query
CREATE INDEX IF NOT EXISTS idx_bookings_date_status
  ON public.bookings(booking_date, status);

-- created_at: ordering by most recent (BookingRequests, inbox)
CREATE INDEX IF NOT EXISTS idx_bookings_created
  ON public.bookings(created_at DESC);

-- ── clients ──────────────────────────────────────────────────
-- phone: phone lookup in edge function (multi-variant search)
CREATE INDEX IF NOT EXISTS idx_clients_phone
  ON public.clients(phone);

-- tenant_id + phone: primary lookup path (Stage 1 in edge function)
CREATE INDEX IF NOT EXISTS idx_clients_tenant_phone
  ON public.clients(tenant_id, phone);

-- tenant_id alone: client list page, POS client selector
CREATE INDEX IF NOT EXISTS idx_clients_tenant
  ON public.clients(tenant_id);

-- ── loyalty_transactions ─────────────────────────────────────
-- client_id + created_at: loyalty history on portal
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_client
  ON public.loyalty_transactions(client_id, created_at DESC);

-- ── client_packages ──────────────────────────────────────────
-- client_id + status: active packages lookup on portal + booking
CREATE INDEX IF NOT EXISTS idx_client_pkgs_lookup
  ON public.client_packages(client_id, status)
  WHERE status = 'active';

-- ── online_booking_requests ──────────────────────────────────
-- booking_id: update when admin confirms/declines
CREATE INDEX IF NOT EXISTS idx_online_req_booking
  ON public.online_booking_requests(booking_id);

-- ── client_portal_tokens ─────────────────────────────────────
-- Already indexed on token + client_id from creation migration.
-- Add composite for cleanup queries (expire old tokens)
CREATE INDEX IF NOT EXISTS idx_portal_tokens_expires
  ON public.client_portal_tokens(expires_at)
  WHERE expires_at < now() + INTERVAL '1 day';
