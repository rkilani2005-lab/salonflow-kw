-- ============================================================
-- Sprint 4: Client Feedback
-- ============================================================

CREATE TABLE public.client_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  booking_id      UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  transaction_id  UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name     TEXT NOT NULL,
  client_phone    TEXT,
  rating          INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment         TEXT,
  service_name    TEXT,
  staff_name      TEXT,
  channel         TEXT NOT NULL DEFAULT 'whatsapp', -- whatsapp | manual | online
  is_public       BOOLEAN NOT NULL DEFAULT false,
  responded_at    TIMESTAMPTZ,
  response_text   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_tenant ON public.client_feedback(tenant_id, created_at DESC);
CREATE INDEX idx_feedback_rating ON public.client_feedback(tenant_id, rating);

ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access feedback"
  ON public.client_feedback FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=client_feedback.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=client_feedback.tenant_id) OR is_super_admin(auth.uid()));

-- Public insert for the feedback link (no auth required)
CREATE POLICY "Public can submit feedback"
  ON public.client_feedback FOR INSERT
  WITH CHECK(true);
