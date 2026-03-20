-- ============================================================
-- Cash Drawer / Day Session Management
-- Tracks opening float, daily collections, and closing balance
-- per branch per day — with variance reporting
-- ============================================================

CREATE TYPE public.session_status AS ENUM (
  'open',     -- Day is open, transactions can be posted
  'closed'    -- Day is closed, summary locked
);

-- ── Main session table ─────────────────────────────────────────
CREATE TABLE public.cash_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id             UUID REFERENCES public.branches(id),

  -- Session identity
  session_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  status                session_status NOT NULL DEFAULT 'open',

  -- Opening
  opening_balance       NUMERIC(10,3) NOT NULL DEFAULT 0,   -- cash float put in drawer
  opened_by             UUID REFERENCES auth.users(id),
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_notes         TEXT,

  -- Closing (filled when status → closed)
  closing_cash_counted  NUMERIC(10,3),   -- physical cash counted at end of day
  closing_knet_terminal NUMERIC(10,3),   -- KNET machine Z-total
  closing_card_terminal NUMERIC(10,3),   -- Credit card terminal total
  closing_notes         TEXT,
  closed_by             UUID REFERENCES auth.users(id),
  closed_at             TIMESTAMPTZ,

  -- Computed fields updated by trigger / application
  -- (stored for fast reporting — recalculated on close)
  total_cash_sales      NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_knet_sales      NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_card_sales      NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_gift_sales      NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_cash_payouts    NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_refunds         NUMERIC(10,3) NOT NULL DEFAULT 0,
  transaction_count     INTEGER        NOT NULL DEFAULT 0,

  -- Expected vs actual cash variance
  -- expected_cash = opening_balance + total_cash_sales - total_cash_payouts
  -- variance = closing_cash_counted - expected_cash
  cash_variance         NUMERIC(10,3),  -- positive = over, negative = short

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Only one open or closed session per branch per date
  UNIQUE (tenant_id, branch_id, session_date)
);

-- ── Cash payouts during the day (petty cash, expenses from till) ──
CREATE TABLE public.session_payouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id),
  amount       NUMERIC(10,3) NOT NULL,
  reason       TEXT NOT NULL,
  paid_to      TEXT,                    -- who received the cash
  paid_by      UUID REFERENCES auth.users(id),
  payout_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_cash_sessions_tenant_date ON public.cash_sessions(tenant_id, session_date DESC);
CREATE INDEX idx_cash_sessions_branch      ON public.cash_sessions(branch_id, session_date DESC);
CREATE INDEX idx_session_payouts_session   ON public.session_payouts(session_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.cash_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access to cash_sessions"
ON public.cash_sessions FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tenant_id = cash_sessions.tenant_id)
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tenant_id = cash_sessions.tenant_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Tenant access to session_payouts"
ON public.session_payouts FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tenant_id = session_payouts.tenant_id)
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tenant_id = session_payouts.tenant_id)
  OR is_super_admin(auth.uid())
);

-- ── updated_at trigger ────────────────────────────────────────
CREATE TRIGGER update_cash_sessions_updated_at
  BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
