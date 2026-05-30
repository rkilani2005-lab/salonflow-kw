
CREATE OR REPLACE FUNCTION public.post_transaction_to_gl(p_transaction_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          AND source_key=COALESCE(v_item.svc_cat,'other') LIMIT 1;
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
    SELECT payment_method::text AS payment_method, SUM(amount) AS amt
      FROM public.transaction_payments
     WHERE transaction_id = p_transaction_id
     GROUP BY payment_method
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
END $function$;
