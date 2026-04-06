-- ============================================================
-- Sprint 2: Loyalty Points, Gift Cards, Promo Codes
-- ============================================================

-- ── 1. Loyalty Points ─────────────────────────────────────────
-- Each tenant configures how many points per KWD spent
-- and what 1 point is worth in KWD when redeeming
CREATE TABLE public.loyalty_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_enabled          BOOLEAN NOT NULL DEFAULT true,
  points_per_kwd      NUMERIC(10,3) NOT NULL DEFAULT 1,   -- e.g. 1 point per 1 KWD
  kwd_per_point       NUMERIC(10,6) NOT NULL DEFAULT 0.01, -- 100 points = 1 KWD
  min_redeem_points   INTEGER NOT NULL DEFAULT 100,
  max_redeem_pct      NUMERIC(5,2) NOT NULL DEFAULT 50,   -- can redeem up to 50% of bill
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Points ledger — one row per earn or redeem event
CREATE TABLE public.loyalty_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  type            TEXT NOT NULL, -- earn | redeem | adjust | expire
  points          INTEGER NOT NULL, -- positive = earn, negative = redeem/expire
  balance_after   INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_client  ON public.loyalty_transactions(client_id, created_at DESC);
CREATE INDEX idx_loyalty_tenant  ON public.loyalty_transactions(tenant_id, created_at DESC);

-- Current points balance per client (maintained by triggers)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

-- ── 2. Gift Cards ──────────────────────────────────────────────
CREATE TABLE public.gift_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  initial_amount  NUMERIC(10,3) NOT NULL,
  balance         NUMERIC(10,3) NOT NULL,
  issued_to_name  TEXT,
  issued_to_phone TEXT,
  issued_by_txn   UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'active', -- active | depleted | void
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE TABLE public.gift_card_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id    UUID NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  type            TEXT NOT NULL, -- issued | redeemed | voided
  amount          NUMERIC(10,3) NOT NULL, -- positive = loaded, negative = redeemed
  balance_after   NUMERIC(10,3) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gift_cards_code    ON public.gift_cards(tenant_id, code);
CREATE INDEX idx_gift_cards_status  ON public.gift_cards(tenant_id, status);

-- ── 3. Promo Codes ────────────────────────────────────────────
CREATE TABLE public.promo_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code              TEXT NOT NULL,
  description       TEXT,
  discount_type     TEXT NOT NULL DEFAULT 'percentage', -- percentage | flat
  discount_value    NUMERIC(10,3) NOT NULL,
  min_order_amount  NUMERIC(10,3) NOT NULL DEFAULT 0,
  max_discount_cap  NUMERIC(10,3),                     -- max KWD discount (for % codes)
  usage_limit       INTEGER,                           -- NULL = unlimited
  usage_count       INTEGER NOT NULL DEFAULT 0,
  valid_from        TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to          TIMESTAMPTZ,                       -- NULL = no expiry
  applies_to        TEXT NOT NULL DEFAULT 'all',       -- all | services | products
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_promo_code  ON public.promo_codes(tenant_id, code, is_active);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.loyalty_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access loyalty_config"
  ON public.loyalty_config FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=loyalty_config.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=loyalty_config.tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant access loyalty_transactions"
  ON public.loyalty_transactions FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=loyalty_transactions.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=loyalty_transactions.tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant access gift_cards"
  ON public.gift_cards FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=gift_cards.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=gift_cards.tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant access gift_card_transactions"
  ON public.gift_card_transactions FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.gift_cards gc JOIN public.profiles p ON p.tenant_id=gc.tenant_id WHERE gc.id=gift_card_transactions.gift_card_id AND p.user_id=auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.gift_cards gc JOIN public.profiles p ON p.tenant_id=gc.tenant_id WHERE gc.id=gift_card_transactions.gift_card_id AND p.user_id=auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant access promo_codes"
  ON public.promo_codes FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=promo_codes.tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=promo_codes.tenant_id) OR is_super_admin(auth.uid()));

-- Updated_at triggers
CREATE TRIGGER update_loyalty_config_updated_at
  BEFORE UPDATE ON public.loyalty_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: validate and get promo code details
CREATE OR REPLACE FUNCTION public.validate_promo_code(
  p_tenant_id UUID,
  p_code      TEXT,
  p_subtotal  NUMERIC
)
RETURNS TABLE(
  id UUID, discount_type TEXT, discount_value NUMERIC,
  discount_amount NUMERIC, max_discount_cap NUMERIC, is_valid BOOLEAN, error_msg TEXT
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_promo public.promo_codes;
  v_disc  NUMERIC;
BEGIN
  SELECT * INTO v_promo FROM public.promo_codes
  WHERE tenant_id = p_tenant_id AND UPPER(code) = UPPER(p_code) AND is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID,'',0::NUMERIC,0::NUMERIC,NULL::NUMERIC,false,'Invalid promo code';
    RETURN;
  END IF;
  IF v_promo.valid_to IS NOT NULL AND now() > v_promo.valid_to THEN
    RETURN QUERY SELECT NULL::UUID,'',0::NUMERIC,0::NUMERIC,NULL::NUMERIC,false,'Promo code has expired';
    RETURN;
  END IF;
  IF now() < v_promo.valid_from THEN
    RETURN QUERY SELECT NULL::UUID,'',0::NUMERIC,0::NUMERIC,NULL::NUMERIC,false,'Promo code is not yet active';
    RETURN;
  END IF;
  IF v_promo.usage_limit IS NOT NULL AND v_promo.usage_count >= v_promo.usage_limit THEN
    RETURN QUERY SELECT NULL::UUID,'',0::NUMERIC,0::NUMERIC,NULL::NUMERIC,false,'Promo code usage limit reached';
    RETURN;
  END IF;
  IF p_subtotal < v_promo.min_order_amount THEN
    RETURN QUERY SELECT NULL::UUID,'',0::NUMERIC,0::NUMERIC,NULL::NUMERIC,false,
      format('Minimum order of %s KWD required', v_promo.min_order_amount);
    RETURN;
  END IF;

  IF v_promo.discount_type = 'percentage' THEN
    v_disc := ROUND(p_subtotal * v_promo.discount_value / 100, 3);
    IF v_promo.max_discount_cap IS NOT NULL THEN
      v_disc := LEAST(v_disc, v_promo.max_discount_cap);
    END IF;
  ELSE
    v_disc := LEAST(v_promo.discount_value, p_subtotal);
  END IF;

  RETURN QUERY SELECT v_promo.id, v_promo.discount_type, v_promo.discount_value,
    v_disc, v_promo.max_discount_cap, true, NULL::TEXT;
END;
$$;
