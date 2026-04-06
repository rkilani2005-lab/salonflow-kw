-- ============================================================
-- Sprint 4: Client Feedback / Ratings
-- ============================================================
CREATE TABLE public.client_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  booking_id      UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  transaction_id  UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  staff_id        UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  client_name     TEXT NOT NULL,
  client_phone    TEXT,
  rating          INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment         TEXT,
  service_name    TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT false,
  source          TEXT NOT NULL DEFAULT 'whatsapp', -- whatsapp | manual | online
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_tenant  ON public.client_feedback(tenant_id, created_at DESC);
CREATE INDEX idx_feedback_rating  ON public.client_feedback(tenant_id, rating);
CREATE INDEX idx_feedback_staff   ON public.client_feedback(staff_id);

ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access feedback"
  ON public.client_feedback FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=client_feedback.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=client_feedback.tenant_id) OR is_super_admin(auth.uid()));

-- Public policy: allow anyone to INSERT feedback (for the rating link page)
CREATE POLICY "Anyone can submit feedback"
  ON public.client_feedback FOR INSERT
  WITH CHECK (true);
