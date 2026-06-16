-- ============================================================================
-- Packages v2 — five package types with deferred-revenue accounting
--   1. session    : N sessions of ONE linked service        (existing behaviour)
--   2. bundle     : a fixed set of DIFFERENT services        (package_items)
--   3. wallet     : prepaid KWD credit with optional bonus   (credit columns)
--   4. membership : recurring monthly entitlement + pg_cron renewal
--   5. unlimited  : unlimited redemptions until expiry        (sessions_total NULL)
--
-- Accounting model (uses existing COA):
--   On SALE  -> Dr cash/card (payment_method)   Cr 2220 Deferred Revenue (pkg)
--                                                  / 2200 Gift Card Liab (wallet)
--   On REDEEM-> Dr 2220/2200 liability           Cr 4xxx service/product revenue
--   Revenue is recognised only as the client consumes the package. A sold-but-
--   unused package is a liability, never revenue. This keeps the P&L honest.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Enum for package type (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'package_type') THEN
    CREATE TYPE public.package_type AS ENUM
      ('session','bundle','wallet','membership','unlimited');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Extend service_packages with the columns the new types need
--    (all nullable / defaulted so existing rows stay valid = type 'session')
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_packages
  ADD COLUMN IF NOT EXISTS package_type     public.package_type NOT NULL DEFAULT 'session',
  -- wallet
  ADD COLUMN IF NOT EXISTS credit_value     numeric(12,3),        -- KWD credit granted to the client
  ADD COLUMN IF NOT EXISTS credit_bonus     numeric(12,3) DEFAULT 0, -- extra credit on top (the "pay 100 get 120")
  -- membership / recurring
  ADD COLUMN IF NOT EXISTS billing_interval text                  -- 'monthly' | 'weekly' | 'yearly' | null
    CHECK (billing_interval IN ('weekly','monthly','yearly')),
  ADD COLUMN IF NOT EXISTS sessions_per_cycle integer,            -- entitlement reset each cycle (null = unlimited within cycle)
  ADD COLUMN IF NOT EXISTS auto_renew       boolean NOT NULL DEFAULT false,
  -- unlimited
  ADD COLUMN IF NOT EXISTS is_unlimited     boolean NOT NULL DEFAULT false;

-- sessions_total may now be NULL (unlimited / pure-wallet packages)
ALTER TABLE public.service_packages ALTER COLUMN sessions_total DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. package_items — child rows for BUNDLE packages (multiple services)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.package_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id  uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES public.services(id) ON DELETE SET NULL,
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_package_items_pkg ON public.package_items(package_id);

-- ---------------------------------------------------------------------------
-- 3. Extend client_packages for wallet credit, membership cycles, per-item use
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_packages
  ADD COLUMN IF NOT EXISTS package_type      public.package_type NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS credit_total      numeric(12,3),   -- wallet: total credit granted (value+bonus)
  ADD COLUMN IF NOT EXISTS credit_remaining  numeric(12,3),   -- wallet: live balance
  ADD COLUMN IF NOT EXISTS is_unlimited      boolean NOT NULL DEFAULT false,
  -- membership cycle tracking
  ADD COLUMN IF NOT EXISTS billing_interval  text,
  ADD COLUMN IF NOT EXISTS sessions_per_cycle integer,
  ADD COLUMN IF NOT EXISTS auto_renew        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cycle_started_at  date,
  ADD COLUMN IF NOT EXISTS renews_at         date,            -- next renewal/entitlement-reset date
  ADD COLUMN IF NOT EXISTS price_paid        numeric(12,3);   -- what client actually paid (for renewal invoicing)

-- per-service consumption ledger for bundles (which of the bundle's items are used)
CREATE TABLE IF NOT EXISTS public.client_package_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_package_id uuid NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
  service_id        uuid REFERENCES public.services(id) ON DELETE SET NULL,
  quantity_total    integer NOT NULL DEFAULT 1,
  quantity_used     integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpi_clientpkg ON public.client_package_items(client_package_id);

-- ---------------------------------------------------------------------------
-- 4. membership_renewals — audit + due-invoice trail for recurring billing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_renewals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_package_id uuid NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
  cycle_date        date NOT NULL,
  amount_due        numeric(12,3) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'due'   -- 'due' | 'collected' | 'waived' | 'failed'
    CHECK (status IN ('due','collected','waived','failed')),
  collected_at      timestamptz,
  transaction_id    uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_package_id, cycle_date)
);
CREATE INDEX IF NOT EXISTS idx_memrenew_tenant ON public.membership_renewals(tenant_id, status);

-- ---------------------------------------------------------------------------
-- 5. RLS — mirror the existing tenant-isolation pattern
-- ---------------------------------------------------------------------------
ALTER TABLE public.package_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_package_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_renewals    ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='package_items' AND policyname='Tenant access package_items') THEN
    CREATE POLICY "Tenant access package_items" ON public.package_items FOR ALL TO authenticated
      USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=package_items.tenant_id) OR is_super_admin(auth.uid()))
      WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=package_items.tenant_id) OR is_super_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_package_items' AND policyname='Tenant access client_package_items') THEN
    CREATE POLICY "Tenant access client_package_items" ON public.client_package_items FOR ALL TO authenticated
      USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=client_package_items.tenant_id) OR is_super_admin(auth.uid()))
      WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=client_package_items.tenant_id) OR is_super_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membership_renewals' AND policyname='Tenant access membership_renewals') THEN
    CREATE POLICY "Tenant access membership_renewals" ON public.membership_renewals FOR ALL TO authenticated
      USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=membership_renewals.tenant_id) OR is_super_admin(auth.uid()))
      WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=membership_renewals.tenant_id) OR is_super_admin(auth.uid()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. sell_package RPC — atomic: create client_package (+ bundle items),
--    snapshot entitlements, set wallet credit / membership cycle.
--    SECURITY DEFINER so all linked rows are created before RLS read-back.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sell_package(
  p_package_id    uuid,
  p_client_id     uuid,
  p_transaction_id uuid DEFAULT NULL,
  p_notes         text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_pkg      RECORD;
  v_cp_id    uuid;
  v_tenant   uuid;
  v_expires  date;
  v_renews   date;
  v_credit   numeric(12,3);
  v_item     RECORD;
BEGIN
  SELECT * INTO v_pkg FROM public.service_packages WHERE id = p_package_id;
  IF v_pkg.id IS NULL THEN RAISE EXCEPTION 'Package not found'; END IF;
  v_tenant := v_pkg.tenant_id;

  -- caller must belong to the tenant
  IF NOT (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=v_tenant)
          OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised for this tenant';
  END IF;

  v_expires := CASE WHEN v_pkg.valid_days IS NOT NULL
                    THEN (current_date + v_pkg.valid_days) ELSE NULL END;

  -- membership: first cycle, renewal date driven by billing_interval
  IF v_pkg.package_type = 'membership' THEN
    v_renews := current_date + CASE v_pkg.billing_interval
                  WHEN 'weekly' THEN 7 WHEN 'yearly' THEN 365 ELSE 30 END;
  END IF;

  -- wallet credit = value + bonus
  IF v_pkg.package_type = 'wallet' THEN
    v_credit := COALESCE(v_pkg.credit_value,0) + COALESCE(v_pkg.credit_bonus,0);
  END IF;

  INSERT INTO public.client_packages(
    tenant_id, package_id, client_id, package_type,
    sessions_total, sessions_used, sessions_remaining, is_unlimited,
    credit_total, credit_remaining,
    billing_interval, sessions_per_cycle, auto_renew,
    cycle_started_at, renews_at,
    purchase_date, expires_at, status,
    transaction_id, price_paid, notes
  ) VALUES (
    v_tenant, p_package_id, p_client_id, v_pkg.package_type,
    CASE WHEN v_pkg.package_type='membership' THEN v_pkg.sessions_per_cycle ELSE v_pkg.sessions_total END,
    0,
    CASE WHEN v_pkg.package_type='membership' THEN v_pkg.sessions_per_cycle ELSE v_pkg.sessions_total END,
    (v_pkg.package_type='unlimited' OR v_pkg.is_unlimited),
    v_credit, v_credit,
    v_pkg.billing_interval, v_pkg.sessions_per_cycle, v_pkg.auto_renew,
    CASE WHEN v_pkg.package_type='membership' THEN current_date ELSE NULL END,
    v_renews,
    current_date, v_expires, 'active',
    p_transaction_id, v_pkg.price, p_notes
  ) RETURNING id INTO v_cp_id;

  -- bundle: copy each package_item into the client's consumption ledger
  IF v_pkg.package_type = 'bundle' THEN
    FOR v_item IN SELECT service_id, quantity FROM public.package_items WHERE package_id = p_package_id LOOP
      INSERT INTO public.client_package_items(tenant_id, client_package_id, service_id, quantity_total, quantity_used)
      VALUES (v_tenant, v_cp_id, v_item.service_id, v_item.quantity, 0);
    END LOOP;
  END IF;

  RETURN v_cp_id;
END $$;

-- ---------------------------------------------------------------------------
-- 7. redeem_package RPC — unified redemption for all types, race-safe.
--    For wallet: pass p_amount (KWD) to debit. For session/bundle/unlimited:
--    pass p_service_id (bundle needs it to find the right line). Locks the row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_package(
  p_client_package_id uuid,
  p_service_id        uuid DEFAULT NULL,
  p_amount            numeric DEFAULT NULL,
  p_booking_id        uuid DEFAULT NULL,
  p_transaction_id    uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_cp     RECORD;
  v_line   RECORD;
  v_new_used int;
  v_depleted boolean := false;
  v_today  date := current_date;
BEGIN
  -- lock the client_package row to serialise concurrent reception terminals
  SELECT * INTO v_cp FROM public.client_packages
    WHERE id = p_client_package_id FOR UPDATE;
  IF v_cp.id IS NULL THEN RAISE EXCEPTION 'Package not found'; END IF;

  IF NOT (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=v_cp.tenant_id)
          OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised for this tenant';
  END IF;

  IF v_cp.status <> 'active' THEN RAISE EXCEPTION 'Package is % and cannot be redeemed', v_cp.status; END IF;
  IF v_cp.expires_at IS NOT NULL AND v_cp.expires_at < v_today THEN
    UPDATE public.client_packages SET status='expired' WHERE id=p_client_package_id;
    RAISE EXCEPTION 'Package has expired';
  END IF;

  IF v_cp.package_type = 'wallet' THEN
    IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Wallet redemption needs a positive amount'; END IF;
    IF COALESCE(v_cp.credit_remaining,0) < p_amount THEN
      RAISE EXCEPTION 'Insufficient wallet credit (have %, need %)', COALESCE(v_cp.credit_remaining,0), p_amount;
    END IF;
    UPDATE public.client_packages
      SET credit_remaining = credit_remaining - p_amount,
          status = CASE WHEN credit_remaining - p_amount <= 0 THEN 'depleted' ELSE 'active' END
      WHERE id = p_client_package_id;

  ELSIF v_cp.package_type = 'bundle' THEN
    SELECT * INTO v_line FROM public.client_package_items
      WHERE client_package_id = p_client_package_id
        AND (service_id = p_service_id OR p_service_id IS NULL)
        AND quantity_used < quantity_total
      ORDER BY (service_id = p_service_id) DESC LIMIT 1;
    IF v_line.id IS NULL THEN RAISE EXCEPTION 'No remaining bundle item for this service'; END IF;
    UPDATE public.client_package_items SET quantity_used = quantity_used + 1 WHERE id = v_line.id;
    -- bundle depletes when every line is fully used
    IF NOT EXISTS(SELECT 1 FROM public.client_package_items
                  WHERE client_package_id = p_client_package_id AND quantity_used < quantity_total) THEN
      UPDATE public.client_packages SET status='depleted' WHERE id = p_client_package_id;
    END IF;

  ELSIF v_cp.package_type = 'unlimited' OR v_cp.is_unlimited THEN
    -- nothing to decrement; just record the redemption below
    NULL;

  ELSE -- 'session' and 'membership' both decrement the session counter
    IF COALESCE(v_cp.sessions_used,0) >= COALESCE(v_cp.sessions_total,0) THEN
      RAISE EXCEPTION 'No sessions remaining';
    END IF;
    v_new_used := COALESCE(v_cp.sessions_used,0) + 1;
    v_depleted := v_new_used >= COALESCE(v_cp.sessions_total,0);
    UPDATE public.client_packages
      SET sessions_used = v_new_used,
          -- keep the stored sessions_remaining column in sync (POS path reads it)
          sessions_remaining = GREATEST(0, COALESCE(sessions_total,0) - v_new_used),
          -- membership never goes 'depleted' (it refills next cycle); session does
          status = CASE WHEN v_depleted AND v_cp.package_type='session' THEN 'depleted' ELSE 'active' END
      WHERE id = p_client_package_id;
  END IF;

  INSERT INTO public.package_redemptions(tenant_id, client_package_id, booking_id, transaction_id)
  VALUES (v_cp.tenant_id, p_client_package_id, p_booking_id, p_transaction_id);

  RETURN jsonb_build_object('ok', true, 'client_package_id', p_client_package_id);
END $$;

-- ---------------------------------------------------------------------------
-- 8. Membership renewal cron — reset entitlements + raise a 'due' renewal row.
--    Collection happens at the desk (no card processor wired yet); when one is
--    added, swap the body of mark-collected for a charge call. Idempotent per
--    (client_package_id, cycle_date) via the UNIQUE constraint.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_membership_renewals()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_cp RECORD;
  v_count int := 0;
  v_next date;
BEGIN
  FOR v_cp IN
    SELECT * FROM public.client_packages
    WHERE package_type = 'membership' AND status = 'active'
      AND renews_at IS NOT NULL AND renews_at <= current_date
  LOOP
    v_next := current_date + CASE v_cp.billing_interval
                WHEN 'weekly' THEN 7 WHEN 'yearly' THEN 365 ELSE 30 END;

    -- raise a due invoice for this cycle (idempotent)
    INSERT INTO public.membership_renewals(tenant_id, client_package_id, cycle_date, amount_due, status)
    VALUES (v_cp.tenant_id, v_cp.id, current_date, COALESCE(v_cp.price_paid,0),
            CASE WHEN v_cp.auto_renew THEN 'due' ELSE 'due' END)
    ON CONFLICT (client_package_id, cycle_date) DO NOTHING;

    -- reset entitlement for the new cycle
    UPDATE public.client_packages
      SET sessions_used = 0,
          sessions_remaining = sessions_total,
          cycle_started_at = current_date,
          renews_at = v_next,
          status = 'active'
      WHERE id = v_cp.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- schedule daily at 02:00 Asia/Kuwait (= 23:00 UTC prev day). pg_cron runs in UTC.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('membership_renewals_daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='membership_renewals_daily');
    PERFORM cron.schedule('membership_renewals_daily', '0 23 * * *',
                          $cron$ SELECT public.run_membership_renewals(); $cron$);
  END IF;
END $$;
