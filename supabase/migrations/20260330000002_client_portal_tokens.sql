-- ============================================================
-- Client Portal — magic link tokens
-- Generated after booking so clients can access their portal
-- ============================================================
CREATE TABLE public.client_portal_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_tokens_token    ON public.client_portal_tokens(token);
CREATE INDEX idx_portal_tokens_client   ON public.client_portal_tokens(client_id);

-- Public: anyone with the token can read (no auth needed)
ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public token lookup" ON public.client_portal_tokens FOR SELECT USING (true);
CREATE POLICY "Service role inserts tokens" ON public.client_portal_tokens FOR INSERT WITH CHECK (true);
