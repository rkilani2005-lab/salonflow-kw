-- ===== Phase 2 schema additions =======================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS gl_category text;
UPDATE public.services SET gl_category = 'other' WHERE gl_category IS NULL;
ALTER TABLE public.services
  ALTER COLUMN gl_category SET DEFAULT 'other',
  ALTER COLUMN gl_category SET NOT NULL;
ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_gl_category_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_gl_category_check
  CHECK (gl_category IN ('hair','nails','facial','makeup','waxing','massage','other'));

ALTER TABLE public.loyalty_config
  ADD COLUMN IF NOT EXISTS points_per_kwd_service numeric,
  ADD COLUMN IF NOT EXISTS points_per_kwd_product numeric;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS refund_of_id uuid REFERENCES public.transactions(id);
CREATE INDEX IF NOT EXISTS idx_transactions_refund_of
  ON public.transactions(refund_of_id) WHERE refund_of_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_source_ref
  ON public.journal_entries(source, source_ref_type, source_ref_id);

ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS transaction_id uuid;
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_txn
  ON public.loyalty_transactions(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_per_sale_type
  ON public.loyalty_transactions(transaction_id, type)
  WHERE transaction_id IS NOT NULL;

-- ===== _next_je_number ================================================
CREATE OR REPLACE FUNCTION public._next_je_number(p_tenant_id uuid, p_prefix text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE);
  v_last text;
  v_next int;
BEGIN
  SELECT entry_number INTO v_last
    FROM public.journal_entries
   WHERE tenant_id = p_tenant_id
     AND entry_number LIKE p_prefix || '-' || v_year || '-%'
   ORDER BY entry_number DESC LIMIT 1;
  v_next := COALESCE(
    NULLIF(regexp_replace(COALESCE(v_last,''), '.*-([0-9]+)$', '\1'), '')::int, 0
  ) + 1;
  RETURN p_prefix || '-' || v_year || '-' || LPAD(v_next::text, 4, '0');
END $$;

-- ===== post_transaction_to_gl =========================================
CREATE OR REPLACE FUNCTION public.post_transaction_to_gl(p_transaction_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_txn RECORD; v_je_id uuid;
  v_total_d numeric := 0; v_total_c numeric := 0;
  v_acct uuid; v_lines jsonb := '[]'::jsonb; v_line jsonb;
  v_item RECORD; v_pay RECORD;
BEGIN
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;
  IF v_txn.id IS NULL OR COALESCE(v_txn.grand_total,0) <= 0 OR v_txn.refund_of_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_je_id FROM public.journal_entries
    WHERE tenant_id = v_txn.tenant_id AND source='pos'
      AND source_ref_type='transaction' AND source_ref_id = p_transaction_id LIMIT 1;
  IF v_je_id IS NOT NULL THEN RETURN v_je_id; END IF;

  FOR v_item IN
    SELECT ti.item_type, ti.item_id, ti.item_name, ti.total_price,
           CASE WHEN ti.item_type='service' THEN
             COALESCE((SELECT gl_category FROM public.services WHERE id=ti.item_id),'other')
           END AS svc_cat
      FROM public.transaction_items ti WHERE ti.transaction_id = p_transaction_id
  LOOP
    IF COALESCE(v_item.total_price,0) <= 0 THEN CONTINUE; END IF;
    IF v_item.item_type='service' THEN
      SELECT credit_account_id INTO v_acct FROM public.gl_mappings
        WHERE tenant_id=v_txn.tenant_id AND mapping_type='revenue_service'
          AND source_key=v_item.svc_cat LIMIT 1;
      IF v_acct IS NULL THEN
        SELECT credit_account_id INTO v_acct FROM public.gl_mappings
          WHERE tenant_id=v_txn.tenant_id AND mapping_type='revenue_service'
            AND source_key='other' LIMIT 1;
      END IF;
    ELSE
      SELECT credit_account_id INTO v_acct FROM public.gl_mappings
        WHERE tenant_id=v_txn.tenant_id AND mapping_type='revenue_product'
          AND source_key='retail' LIMIT 1;
    END IF;
    IF v_acct IS NULL THEN
      RAISE EXCEPTION 'Missing revenue mapping (%, %)', v_item.item_type, COALESCE(v_item.svc_cat,'retail');
    END IF;
    v_lines := v_lines || jsonb_build_object('account_id',v_acct,'debit',0,'credit',v_item.total_price,'description',v_item.item_name);
    v_total_c := v_total_c + v_item.total_price;
  END LOOP;

  FOR v_pay IN
    SELECT payment_method, SUM(amount) AS amt FROM public.transaction_payments
     WHERE transaction_id = p_transaction_id GROUP BY payment_method
  LOOP
    IF COALESCE(v_pay.amt,0) <= 0 THEN CONTINUE; END IF;
    SELECT debit_account_id INTO v_acct FROM public.gl_mappings
      WHERE tenant_id=v_txn.tenant_id AND mapping_type='payment_method'
        AND source_key=v_pay.payment_method LIMIT 1;
    IF v_acct IS NULL THEN
      RAISE EXCEPTION 'Missing payment_method mapping %', v_pay.payment_method;
    END IF;
    v_lines := v_lines || jsonb_build_object('account_id',v_acct,'debit',v_pay.amt,'credit',0,'description','Payment '||v_pay.payment_method);
    v_total_d := v_total_d + v_pay.amt;
  END LOOP;

  IF COALESCE(v_txn.discount_amount,0) > 0 THEN
    SELECT debit_account_id INTO v_acct FROM public.gl_mappings
      WHERE tenant_id=v_txn.tenant_id AND mapping_type='sales_discount' LIMIT 1;
    IF v_acct IS NULL THEN
      SELECT credit_account_id INTO v_acct FROM public.gl_mappings
        WHERE tenant_id=v_txn.tenant_id AND mapping_type='revenue_service' AND source_key='other' LIMIT 1;
    END IF;
    IF v_acct IS NULL THEN
      RAISE EXCEPTION 'Missing discount mapping';
    END IF;
    v_lines := v_lines || jsonb_build_object('account_id',v_acct,'debit',v_txn.discount_amount,'credit',0,'description','Discount');
    v_total_d := v_total_d + v_txn.discount_amount;
  END IF;

  IF COALESCE(v_txn.tax_amount,0) > 0 THEN
    SELECT credit_account_id INTO v_acct FROM public.gl_mappings
      WHERE tenant_id=v_txn.tenant_id AND mapping_type='sales_tax' LIMIT 1;
    IF v_acct IS NULL THEN RAISE EXCEPTION 'Missing sales_tax mapping'; END IF;
    v_lines := v_lines || jsonb_build_object('account_id',v_acct,'debit',0,'credit',v_txn.tax_amount,'description','Sales tax');
    v_total_c := v_total_c + v_txn.tax_amount;
  END IF;

  IF COALESCE(v_txn.tip_amount,0) > 0 THEN
    SELECT credit_account_id INTO v_acct FROM public.gl_mappings
      WHERE tenant_id=v_txn.tenant_id AND mapping_type='tip' LIMIT 1;
    IF v_acct IS NULL THEN RAISE EXCEPTION 'Missing tip mapping'; END IF;
    v_lines := v_lines || jsonb_build_object('account_id',v_acct,'debit',0,'credit',v_txn.tip_amount,'description','Tip (staff payable)');
    v_total_c := v_total_c + v_txn.tip_amount;
  END IF;

  IF jsonb_array_length(v_lines) = 0 THEN RETURN NULL; END IF;
  IF ROUND((v_total_d - v_total_c)::numeric, 3) <> 0 THEN
    RAISE EXCEPTION 'Unbalanced JE for transaction % (D=% C=%)', p_transaction_id, v_total_d, v_total_c;
  END IF;

  INSERT INTO public.journal_entries
    (tenant_id, entry_number, entry_date, source, source_ref_id, source_ref_type, description, is_posted)
  VALUES (v_txn.tenant_id, public._next_je_number(v_txn.tenant_id,'POS'),
          v_txn.created_at::date, 'pos', p_transaction_id, 'transaction',
          'POS Sale '||substring(p_transaction_id::text from 1 for 8), true)
  RETURNING id INTO v_je_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    INSERT INTO public.journal_lines(journal_entry_id,account_id,debit,credit,description)
    VALUES (v_je_id,(v_line->>'account_id')::uuid,
            (v_line->>'debit')::numeric,(v_line->>'credit')::numeric,v_line->>'description');
  END LOOP;
  RETURN v_je_id;
END $$;

-- ===== post_service_consumption_to_gl =================================
CREATE OR REPLACE FUNCTION public.post_service_consumption_to_gl(p_transaction_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_txn RECORD; v_je_id uuid;
  v_total numeric; v_dr_acct uuid; v_cr_acct uuid;
  v_svc_cat text;
BEGIN
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;
  IF v_txn.id IS NULL OR COALESCE(v_txn.grand_total,0) <= 0 OR v_txn.refund_of_id IS NOT NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_je_id FROM public.journal_entries
    WHERE tenant_id=v_txn.tenant_id AND source='pos_cogs' AND source_ref_id=p_transaction_id LIMIT 1;
  IF v_je_id IS NOT NULL THEN RETURN v_je_id; END IF;

  SELECT COALESCE(SUM(ABS(it.quantity_change) * COALESCE(p.cost_price,0)), 0)
    INTO v_total
    FROM public.inventory_transactions it
    JOIN public.products p ON p.id = it.product_id
   WHERE it.reference_id = p_transaction_id
     AND it.reference_type = 'pos_transaction'
     AND it.transaction_type = 'service_consumption';
  IF v_total IS NULL OR v_total <= 0 THEN RETURN NULL; END IF;

  SELECT COALESCE(
    (SELECT s.gl_category FROM public.transaction_items ti
       JOIN public.services s ON s.id = ti.item_id
      WHERE ti.transaction_id = p_transaction_id AND ti.item_type='service'
      ORDER BY ti.id LIMIT 1), 'other') INTO v_svc_cat;

  SELECT debit_account_id, credit_account_id INTO v_dr_acct, v_cr_acct
    FROM public.gl_mappings
   WHERE tenant_id=v_txn.tenant_id AND mapping_type='expense'
     AND source_key='cogs_'||v_svc_cat LIMIT 1;
  IF v_dr_acct IS NULL THEN
    SELECT debit_account_id, credit_account_id INTO v_dr_acct, v_cr_acct
      FROM public.gl_mappings
     WHERE tenant_id=v_txn.tenant_id AND mapping_type='expense' AND source_key='cogs_hair' LIMIT 1;
  END IF;
  IF v_dr_acct IS NULL OR v_cr_acct IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.journal_entries
    (tenant_id, entry_number, entry_date, source, source_ref_id, source_ref_type, description, is_posted)
  VALUES (v_txn.tenant_id, public._next_je_number(v_txn.tenant_id,'COGS'),
          v_txn.created_at::date, 'pos_cogs', p_transaction_id, 'transaction',
          'COGS for sale '||substring(p_transaction_id::text from 1 for 8), true)
  RETURNING id INTO v_je_id;

  INSERT INTO public.journal_lines(journal_entry_id,account_id,debit,credit,description)
  VALUES (v_je_id, v_dr_acct, v_total, 0, 'COGS — service consumption'),
         (v_je_id, v_cr_acct, 0, v_total, 'Inventory — service consumption');
  RETURN v_je_id;
END $$;

-- ===== award_loyalty ==================================================
CREATE OR REPLACE FUNCTION public.award_loyalty(p_transaction_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_txn RECORD; v_cfg RECORD;
  v_svc_sub numeric := 0; v_prd_sub numeric := 0;
  v_ratio numeric := 1; v_pts_svc numeric; v_pts_prd numeric;
  v_pts int; v_bal int;
BEGIN
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;
  IF v_txn.id IS NULL OR v_txn.client_id IS NULL THEN RETURN 0; END IF;
  IF COALESCE(v_txn.grand_total,0) <= 0 OR v_txn.refund_of_id IS NOT NULL THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.loyalty_transactions
              WHERE transaction_id=p_transaction_id AND type='earn') THEN RETURN 0; END IF;

  SELECT * INTO v_cfg FROM public.loyalty_config WHERE tenant_id=v_txn.tenant_id LIMIT 1;
  IF v_cfg.id IS NULL OR NOT COALESCE(v_cfg.is_active,false) THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(CASE WHEN item_type='service' THEN total_price ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN item_type='product' THEN total_price ELSE 0 END),0)
    INTO v_svc_sub, v_prd_sub
    FROM public.transaction_items WHERE transaction_id=p_transaction_id;

  IF (v_svc_sub + v_prd_sub) > 0 AND COALESCE(v_txn.discount_amount,0) > 0 THEN
    v_ratio := GREATEST(0, 1 - (v_txn.discount_amount / (v_svc_sub + v_prd_sub)));
  END IF;
  v_svc_sub := v_svc_sub * v_ratio;
  v_prd_sub := v_prd_sub * v_ratio;

  v_pts_svc := COALESCE(v_cfg.points_per_kwd_service, v_cfg.points_per_kwd, 0);
  v_pts_prd := COALESCE(v_cfg.points_per_kwd_product, v_cfg.points_per_kwd, 0);
  v_pts := FLOOR(v_svc_sub * v_pts_svc + v_prd_sub * v_pts_prd);
  IF v_pts <= 0 THEN RETURN 0; END IF;

  UPDATE public.clients
     SET loyalty_points = COALESCE(loyalty_points,0) + v_pts, updated_at = now()
   WHERE id = v_txn.client_id RETURNING loyalty_points INTO v_bal;

  INSERT INTO public.loyalty_transactions
    (tenant_id, client_id, transaction_id, type, points, balance_after, note)
  VALUES (v_txn.tenant_id, v_txn.client_id, p_transaction_id, 'earn',
          v_pts, v_bal, 'Auto-awarded from sale '||substring(p_transaction_id::text from 1 for 8));
  RETURN v_pts;
END $$;

-- ===== reverse_loyalty ================================================
CREATE OR REPLACE FUNCTION public.reverse_loyalty(p_refund_transaction_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref RECORD; v_orig RECORD; v_earn RECORD;
  v_ratio numeric; v_rev int; v_bal int;
BEGIN
  SELECT * INTO v_ref FROM public.transactions WHERE id=p_refund_transaction_id;
  IF v_ref.id IS NULL OR v_ref.refund_of_id IS NULL THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.loyalty_transactions
              WHERE transaction_id=p_refund_transaction_id AND type='reverse') THEN RETURN 0; END IF;

  SELECT * INTO v_orig FROM public.transactions WHERE id=v_ref.refund_of_id;
  IF v_orig.id IS NULL OR v_orig.client_id IS NULL OR COALESCE(v_orig.grand_total,0)<=0 THEN RETURN 0; END IF;

  SELECT * INTO v_earn FROM public.loyalty_transactions
    WHERE transaction_id=v_orig.id AND type='earn' LIMIT 1;
  IF v_earn.id IS NULL OR v_earn.points <= 0 THEN RETURN 0; END IF;

  v_ratio := LEAST(1, ABS(v_ref.grand_total) / v_orig.grand_total);
  v_rev := -CEIL(v_earn.points * v_ratio)::int;
  IF v_rev = 0 THEN RETURN 0; END IF;

  UPDATE public.clients
     SET loyalty_points = GREATEST(0, COALESCE(loyalty_points,0) + v_rev), updated_at = now()
   WHERE id = v_orig.client_id RETURNING loyalty_points INTO v_bal;

  INSERT INTO public.loyalty_transactions
    (tenant_id, client_id, transaction_id, type, points, balance_after, note)
  VALUES (v_ref.tenant_id, v_orig.client_id, p_refund_transaction_id, 'reverse',
          v_rev, v_bal, 'Reversed via refund '||substring(p_refund_transaction_id::text from 1 for 8));
  RETURN v_rev;
END $$;

-- ===== Trigger ========================================================
CREATE OR REPLACE FUNCTION public.tg_transactions_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.refund_of_id IS NOT NULL THEN
    BEGIN PERFORM public.reverse_loyalty(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'reverse_loyalty failed for %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.grand_total,0) <= 0 OR NEW.status = 'refunded' THEN RETURN NEW; END IF;
  -- Note: transaction_items / transaction_payments are inserted later by
  -- the app code in separate statements.  This trigger therefore serves
  -- as the safety net for non-UI inserts; the UI explicitly invokes the
  -- posters after the child rows are committed (see useTransactions.ts).
  BEGIN PERFORM public.post_transaction_to_gl(NEW.id);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'post_transaction_to_gl: %', SQLERRM; END;
  BEGIN PERFORM public.post_service_consumption_to_gl(NEW.id);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'post_service_consumption_to_gl: %', SQLERRM; END;
  BEGIN PERFORM public.award_loyalty(NEW.id);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'award_loyalty: %', SQLERRM; END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_transactions_after_insert ON public.transactions;
CREATE TRIGGER trg_transactions_after_insert
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_transactions_after_insert();

GRANT EXECUTE ON FUNCTION public._next_je_number(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_transaction_to_gl(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_service_consumption_to_gl(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_loyalty(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_loyalty(uuid) TO authenticated, service_role;