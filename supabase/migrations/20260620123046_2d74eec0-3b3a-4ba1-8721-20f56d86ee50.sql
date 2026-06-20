-- ============================================================================
-- Packages v2 — five package types with deferred-revenue accounting
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'package_type') THEN
    CREATE TYPE public.package_type AS ENUM
      ('session','bundle','wallet','membership','unlimited');
  END IF;
END $$;

ALTER TABLE public.service_packages
  ADD COLUMN IF NOT EXISTS package_type     public.package_type NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS credit_value     numeric(12,3),
  ADD COLUMN IF NOT EXISTS credit_bonus     numeric(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_interval text
    CHECK (billing_interval IN ('weekly','monthly','yearly')),
  ADD COLUMN IF NOT EXISTS sessions_per_cycle integer,
  ADD COLUMN IF NOT EXISTS auto_renew       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_unlimited     boolean NOT NULL DEFAULT false;

ALTER TABLE public.service_packages ALTER COLUMN sessions_total DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.package_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id  uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES public.services(id) ON DELETE SET NULL,
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_package_items_pkg ON public.package_items(package_id);

ALTER TABLE public.client_packages
  ADD COLUMN IF NOT EXISTS package_type      public.package_type NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS credit_total      numeric(12,3),
  ADD COLUMN IF NOT EXISTS credit_remaining  numeric(12,3),
  ADD COLUMN IF NOT EXISTS is_unlimited      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_interval  text,
  ADD COLUMN IF NOT EXISTS sessions_per_cycle integer,
  ADD COLUMN IF NOT EXISTS auto_renew        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cycle_started_at  date,
  ADD COLUMN IF NOT EXISTS renews_at         date,
  ADD COLUMN IF NOT EXISTS price_paid        numeric(12,3);

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

CREATE TABLE IF NOT EXISTS public.membership_renewals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_package_id uuid NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
  cycle_date        date NOT NULL,
  amount_due        numeric(12,3) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'due'
    CHECK (status IN ('due','collected','waived','failed')),
  collected_at      timestamptz,
  transaction_id    uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_package_id, cycle_date)
);
CREATE INDEX IF NOT EXISTS idx_memrenew_tenant ON public.membership_renewals(tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_items TO authenticated;
GRANT ALL ON public.package_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_package_items TO authenticated;
GRANT ALL ON public.client_package_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_renewals TO authenticated;
GRANT ALL ON public.membership_renewals TO service_role;

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

  IF NOT (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=v_tenant)
          OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised for this tenant';
  END IF;

  v_expires := CASE WHEN v_pkg.valid_days IS NOT NULL
                    THEN (current_date + v_pkg.valid_days) ELSE NULL END;

  IF v_pkg.package_type = 'membership' THEN
    v_renews := current_date + CASE v_pkg.billing_interval
                  WHEN 'weekly' THEN 7 WHEN 'yearly' THEN 365 ELSE 30 END;
  END IF;

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

  IF v_pkg.package_type = 'bundle' THEN
    FOR v_item IN SELECT service_id, quantity FROM public.package_items WHERE package_id = p_package_id LOOP
      INSERT INTO public.client_package_items(tenant_id, client_package_id, service_id, quantity_total, quantity_used)
      VALUES (v_tenant, v_cp_id, v_item.service_id, v_item.quantity, 0);
    END LOOP;
  END IF;

  RETURN v_cp_id;
END $$;

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
    IF NOT EXISTS(SELECT 1 FROM public.client_package_items
                  WHERE client_package_id = p_client_package_id AND quantity_used < quantity_total) THEN
      UPDATE public.client_packages SET status='depleted' WHERE id = p_client_package_id;
    END IF;

  ELSIF v_cp.package_type = 'unlimited' OR v_cp.is_unlimited THEN
    NULL;

  ELSE
    IF COALESCE(v_cp.sessions_used,0) >= COALESCE(v_cp.sessions_total,0) THEN
      RAISE EXCEPTION 'No sessions remaining';
    END IF;
    v_new_used := COALESCE(v_cp.sessions_used,0) + 1;
    v_depleted := v_new_used >= COALESCE(v_cp.sessions_total,0);
    UPDATE public.client_packages
      SET sessions_used = v_new_used,
          sessions_remaining = GREATEST(0, COALESCE(sessions_total,0) - v_new_used),
          status = CASE WHEN v_depleted AND v_cp.package_type='session' THEN 'depleted' ELSE 'active' END
      WHERE id = p_client_package_id;
  END IF;

  INSERT INTO public.package_redemptions(tenant_id, client_package_id, booking_id, transaction_id)
  VALUES (v_cp.tenant_id, p_client_package_id, p_booking_id, p_transaction_id);

  RETURN jsonb_build_object('ok', true, 'client_package_id', p_client_package_id);
END $$;

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

    INSERT INTO public.membership_renewals(tenant_id, client_package_id, cycle_date, amount_due, status)
    VALUES (v_cp.tenant_id, v_cp.id, current_date, COALESCE(v_cp.price_paid,0),
            CASE WHEN v_cp.auto_renew THEN 'due' ELSE 'due' END)
    ON CONFLICT (client_package_id, cycle_date) DO NOTHING;

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('membership_renewals_daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='membership_renewals_daily');
    PERFORM cron.schedule('membership_renewals_daily', '0 23 * * *',
                          $cron$ SELECT public.run_membership_renewals(); $cron$);
  END IF;
END $$;

-- ============================================================================
-- Packages v2 — deferred-revenue GL postings
-- ============================================================================

CREATE OR REPLACE FUNCTION public._pkg_liability_account(p_tenant uuid, p_type public.package_type)
RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT id FROM public.chart_of_accounts
   WHERE tenant_id = p_tenant
     AND code = CASE WHEN p_type = 'wallet' THEN '2200' ELSE '2220' END
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.post_package_sale_to_gl(
  p_client_package_id uuid,
  p_payment_method    text DEFAULT 'cash'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_cp RECORD; v_je uuid; v_pay_acct uuid; v_liab_acct uuid; v_amt numeric;
BEGIN
  SELECT * INTO v_cp FROM public.client_packages WHERE id = p_client_package_id;
  IF v_cp.id IS NULL THEN RETURN NULL; END IF;
  v_amt := COALESCE(v_cp.price_paid,0);
  IF v_amt <= 0 THEN RETURN NULL; END IF;

  SELECT id INTO v_je FROM public.journal_entries
    WHERE tenant_id=v_cp.tenant_id AND source='package'
      AND source_ref_type='package_sale' AND source_ref_id=p_client_package_id LIMIT 1;
  IF v_je IS NOT NULL THEN RETURN v_je; END IF;

  SELECT debit_account_id INTO v_pay_acct FROM public.gl_mappings
    WHERE tenant_id=v_cp.tenant_id AND mapping_type='payment_method'
      AND source_key=p_payment_method LIMIT 1;
  IF v_pay_acct IS NULL THEN RAISE EXCEPTION 'Missing payment_method mapping %', p_payment_method; END IF;

  v_liab_acct := public._pkg_liability_account(v_cp.tenant_id, v_cp.package_type);
  IF v_liab_acct IS NULL THEN RAISE EXCEPTION 'Missing package liability account (2220/2200)'; END IF;

  INSERT INTO public.journal_entries
    (tenant_id, entry_number, entry_date, source, source_ref_id, source_ref_type, description, is_posted)
  VALUES (v_cp.tenant_id, public._next_je_number(v_cp.tenant_id,'PKG'),
          current_date, 'package', p_client_package_id, 'package_sale',
          'Package sale '||substring(p_client_package_id::text from 1 for 8), true)
  RETURNING id INTO v_je;

  INSERT INTO public.journal_lines(journal_entry_id,account_id,debit,credit,description) VALUES
    (v_je, v_pay_acct, v_amt, 0, 'Package payment '||p_payment_method),
    (v_je, v_liab_acct, 0, v_amt, 'Deferred package revenue');
  RETURN v_je;
END $$;

CREATE OR REPLACE FUNCTION public.post_package_redemption_to_gl(
  p_client_package_id uuid,
  p_service_id        uuid DEFAULT NULL,
  p_amount            numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_cp RECORD; v_je uuid; v_liab uuid; v_rev uuid; v_amt numeric; v_cat text;
BEGIN
  SELECT * INTO v_cp FROM public.client_packages WHERE id = p_client_package_id;
  IF v_cp.id IS NULL THEN RETURN NULL; END IF;

  IF v_cp.package_type = 'wallet' THEN
    v_amt := p_amount;
  ELSE
    SELECT price, COALESCE(gl_category,'other') INTO v_amt, v_cat
      FROM public.services WHERE id = p_service_id;
  END IF;
  IF COALESCE(v_amt,0) <= 0 THEN RETURN NULL; END IF;

  v_liab := public._pkg_liability_account(v_cp.tenant_id, v_cp.package_type);

  SELECT credit_account_id INTO v_rev FROM public.gl_mappings
    WHERE tenant_id=v_cp.tenant_id AND mapping_type='revenue_service'
      AND source_key=COALESCE(v_cat,'other') LIMIT 1;
  IF v_rev IS NULL THEN
    SELECT credit_account_id INTO v_rev FROM public.gl_mappings
      WHERE tenant_id=v_cp.tenant_id AND mapping_type='revenue_service' AND source_key='other' LIMIT 1;
  END IF;
  IF v_liab IS NULL OR v_rev IS NULL THEN RAISE EXCEPTION 'Missing liability/revenue mapping for redemption'; END IF;

  INSERT INTO public.journal_entries
    (tenant_id, entry_number, entry_date, source, source_ref_id, source_ref_type, description, is_posted)
  VALUES (v_cp.tenant_id, public._next_je_number(v_cp.tenant_id,'PKG'),
          current_date, 'package', p_client_package_id, 'package_redemption',
          'Package redemption '||substring(p_client_package_id::text from 1 for 8), true)
  RETURNING id INTO v_je;

  INSERT INTO public.journal_lines(journal_entry_id,account_id,debit,credit,description) VALUES
    (v_je, v_liab, v_amt, 0, 'Recognise package liability'),
    (v_je, v_rev,  0, v_amt, 'Package revenue earned');
  RETURN v_je;
END $$;

-- ============================================================================
-- Packages v2 — POS redeem_package_for_item (type-aware)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.redeem_package_for_item(
  p_transaction_item_id uuid,
  p_client_package_id   uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item   RECORD;
  v_pkg    RECORD;
  v_svc_pk RECORD;
  v_line   RECORD;
  v_updated int;
  v_remaining int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.package_redemptions
             WHERE transaction_item_id = p_transaction_item_id AND reversed_at IS NULL) THEN
    RETURN true;
  END IF;

  SELECT ti.*, t.tenant_id AS txn_tenant, t.client_id AS txn_client, t.id AS txn_id
    INTO v_item
    FROM public.transaction_items ti
    JOIN public.transactions t ON t.id = ti.transaction_id
   WHERE ti.id = p_transaction_item_id;
  IF v_item.id IS NULL OR v_item.item_type <> 'service' THEN RETURN false; END IF;

  SELECT * INTO v_pkg FROM public.client_packages WHERE id = p_client_package_id FOR UPDATE;
  IF v_pkg.id IS NULL THEN RETURN false; END IF;
  IF v_pkg.tenant_id <> v_item.txn_tenant THEN RETURN false; END IF;
  IF v_pkg.client_id IS DISTINCT FROM v_item.txn_client THEN RETURN false; END IF;
  IF v_pkg.status <> 'active' THEN RETURN false; END IF;
  IF v_pkg.expires_at IS NOT NULL AND v_pkg.expires_at < CURRENT_DATE THEN RETURN false; END IF;

  SELECT * INTO v_svc_pk FROM public.service_packages WHERE id = v_pkg.package_id;
  IF v_svc_pk.id IS NULL THEN RETURN false; END IF;

  IF v_pkg.package_type = 'wallet' THEN
    RETURN false;

  ELSIF v_pkg.package_type = 'bundle' THEN
    SELECT * INTO v_line FROM public.client_package_items
      WHERE client_package_id = p_client_package_id
        AND service_id = v_item.item_id
        AND quantity_used < quantity_total
      LIMIT 1 FOR UPDATE;
    IF v_line.id IS NULL THEN RETURN false; END IF;
    UPDATE public.client_package_items SET quantity_used = quantity_used + 1 WHERE id = v_line.id;
    IF NOT EXISTS (SELECT 1 FROM public.client_package_items
                   WHERE client_package_id = p_client_package_id AND quantity_used < quantity_total) THEN
      UPDATE public.client_packages SET status = 'depleted' WHERE id = p_client_package_id;
    END IF;

  ELSIF v_pkg.package_type = 'unlimited' OR v_pkg.is_unlimited THEN
    IF v_svc_pk.service_id IS NOT NULL AND v_svc_pk.service_id IS DISTINCT FROM v_item.item_id THEN
      RETURN false;
    END IF;

  ELSE
    IF v_svc_pk.service_id IS NOT NULL AND v_svc_pk.service_id IS DISTINCT FROM v_item.item_id THEN
      RETURN false;
    END IF;
    v_remaining := COALESCE(v_pkg.sessions_remaining, v_pkg.sessions_total - COALESCE(v_pkg.sessions_used,0));
    UPDATE public.client_packages
       SET sessions_used = COALESCE(sessions_used,0) + 1,
           sessions_remaining = GREATEST(0, v_remaining - 1),
           status = CASE WHEN (v_remaining - 1) <= 0 AND package_type = 'session'
                         THEN 'depleted' ELSE status END
     WHERE id = p_client_package_id
       AND COALESCE(sessions_remaining, sessions_total - COALESCE(sessions_used,0)) > 0
       AND status = 'active';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN RETURN false; END IF;
  END IF;

  INSERT INTO public.package_redemptions
    (tenant_id, client_package_id, transaction_id, transaction_item_id, redeemed_at)
  VALUES (v_item.txn_tenant, p_client_package_id, v_item.txn_id, p_transaction_item_id, now());

  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.redeem_package_for_item(uuid, uuid) TO authenticated;
