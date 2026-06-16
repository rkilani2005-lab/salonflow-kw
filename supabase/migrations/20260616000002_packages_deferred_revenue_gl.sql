-- ============================================================================
-- Packages v2 — deferred-revenue GL postings
--
-- Two events, two journal entries:
--
--  A) SALE of a package (money in, but not yet earned):
--       Dr  cash/card           (payment_method mapping)   = price paid
--       Cr  2220 Deferred Rev (packages)  -- or 2200 Gift Card Liab (wallet)
--
--  B) REDEMPTION (entitlement consumed -> revenue earned):
--       Dr  2220 / 2200 liability        = recognised value
--       Cr  4xxx service/product revenue = recognised value
--
-- The "recognised value" on redemption is the fair price of the service
-- consumed (or the wallet amount debited), NOT the discounted package price.
-- The discount the client got is absorbed across the liability drawdown, which
-- is the correct treatment: revenue is recognised at standalone selling price
-- and the liability is sized at what the client paid, so any difference washes
-- out as the package is fully consumed.
-- ============================================================================

-- helper: resolve the deferred-revenue liability account for a package type
CREATE OR REPLACE FUNCTION public._pkg_liability_account(p_tenant uuid, p_type public.package_type)
RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT id FROM public.chart_of_accounts
   WHERE tenant_id = p_tenant
     AND code = CASE WHEN p_type = 'wallet' THEN '2200' ELSE '2220' END
   LIMIT 1;
$$;

-- A) post the SALE of a package to the GL
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

  -- idempotency: one sale JE per client_package
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

-- B) post a REDEMPTION (recognise revenue from the liability)
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

  -- recognised amount: wallet uses the debited amount; others use service price
  IF v_cp.package_type = 'wallet' THEN
    v_amt := p_amount;
  ELSE
    SELECT price, COALESCE(gl_category,'other') INTO v_amt, v_cat
      FROM public.services WHERE id = p_service_id;
  END IF;
  IF COALESCE(v_amt,0) <= 0 THEN RETURN NULL; END IF;

  v_liab := public._pkg_liability_account(v_cp.tenant_id, v_cp.package_type);

  -- revenue account: service category mapping, fallback to 'other'
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
