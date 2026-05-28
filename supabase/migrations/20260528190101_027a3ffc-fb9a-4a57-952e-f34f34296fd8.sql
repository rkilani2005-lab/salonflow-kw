-- Phase 3: package redemption at POS
-- Non-destructive: only adds columns/functions, replaces existing trigger function.

-- 1. Extend package_redemptions to support per-line idempotency and refund reversal
ALTER TABLE public.package_redemptions
  ADD COLUMN IF NOT EXISTS transaction_item_id uuid REFERENCES public.transaction_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz;

-- Backfill tenant_id from client_packages for existing rows
UPDATE public.package_redemptions pr
   SET tenant_id = cp.tenant_id
  FROM public.client_packages cp
 WHERE pr.client_package_id = cp.id
   AND pr.tenant_id IS NULL;

-- One redemption per cart line (idempotency key). Excludes reversed rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_package_redemption_per_item
  ON public.package_redemptions(transaction_item_id)
  WHERE transaction_item_id IS NOT NULL AND reversed_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_package_redemptions_txn ON public.package_redemptions(transaction_id);

-- 2. Idempotent per-line redemption
CREATE OR REPLACE FUNCTION public.redeem_package_for_item(
  p_transaction_item_id uuid,
  p_client_package_id   uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item   RECORD;
  v_txn    RECORD;
  v_pkg    RECORD;
  v_svc_pk RECORD;
  v_updated int;
BEGIN
  -- Already redeemed for this line? idempotent success
  IF EXISTS (
    SELECT 1 FROM public.package_redemptions
     WHERE transaction_item_id = p_transaction_item_id
       AND reversed_at IS NULL
  ) THEN RETURN true; END IF;

  SELECT ti.*, t.tenant_id AS txn_tenant, t.client_id AS txn_client, t.id AS txn_id
    INTO v_item
    FROM public.transaction_items ti
    JOIN public.transactions t ON t.id = ti.transaction_id
   WHERE ti.id = p_transaction_item_id;
  IF v_item.id IS NULL THEN RETURN false; END IF;
  IF v_item.item_type <> 'service' THEN RETURN false; END IF;

  SELECT * INTO v_pkg FROM public.client_packages WHERE id = p_client_package_id FOR UPDATE;
  IF v_pkg.id IS NULL THEN RETURN false; END IF;
  IF v_pkg.tenant_id <> v_item.txn_tenant THEN RETURN false; END IF;
  IF v_pkg.client_id IS DISTINCT FROM v_item.txn_client THEN RETURN false; END IF;
  IF v_pkg.status <> 'active' THEN RETURN false; END IF;
  IF v_pkg.expires_at IS NOT NULL AND v_pkg.expires_at < CURRENT_DATE THEN RETURN false; END IF;

  SELECT * INTO v_svc_pk FROM public.service_packages WHERE id = v_pkg.package_id;
  IF v_svc_pk.id IS NULL THEN RETURN false; END IF;
  -- Service eligibility: package.service_id must match the cart line's service
  IF v_svc_pk.service_id IS DISTINCT FROM v_item.item_id THEN RETURN false; END IF;

  -- Atomic decrement: only decrements if sessions still remain
  UPDATE public.client_packages
     SET sessions_used      = COALESCE(sessions_used,0) + 1,
         sessions_remaining = GREATEST(0, COALESCE(sessions_remaining, sessions_total - COALESCE(sessions_used,0)) - 1),
         status = CASE WHEN COALESCE(sessions_remaining, sessions_total - COALESCE(sessions_used,0)) - 1 <= 0
                       THEN 'depleted' ELSE status END
   WHERE id = p_client_package_id
     AND COALESCE(sessions_remaining, sessions_total - COALESCE(sessions_used,0)) > 0
     AND status = 'active';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RETURN false; END IF;

  INSERT INTO public.package_redemptions
    (tenant_id, client_package_id, transaction_id, transaction_item_id, redeemed_at)
  VALUES (v_item.txn_tenant, p_client_package_id, v_item.txn_id, p_transaction_item_id, now());

  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.redeem_package_for_item(uuid, uuid) TO authenticated;

-- 3. Refund reversal: restore one session per redemption tied to the refunded sale
CREATE OR REPLACE FUNCTION public.reverse_package_redemptions(p_refund_transaction_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
  v_r   RECORD;
  v_count int := 0;
BEGIN
  SELECT * INTO v_ref FROM public.transactions WHERE id = p_refund_transaction_id;
  IF v_ref.id IS NULL OR v_ref.refund_of_id IS NULL THEN RETURN 0; END IF;

  FOR v_r IN
    SELECT id, client_package_id FROM public.package_redemptions
     WHERE transaction_id = v_ref.refund_of_id
       AND reversed_at IS NULL
  LOOP
    UPDATE public.client_packages
       SET sessions_used      = GREATEST(0, COALESCE(sessions_used,0) - 1),
           sessions_remaining = COALESCE(sessions_remaining,0) + 1,
           status = CASE WHEN status = 'depleted' THEN 'active' ELSE status END
     WHERE id = v_r.client_package_id;
    UPDATE public.package_redemptions
       SET reversed_at = now()
     WHERE id = v_r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.reverse_package_redemptions(uuid) TO authenticated;

-- 4. Wire reversal into the existing refund branch of the transactions trigger
CREATE OR REPLACE FUNCTION public.tg_transactions_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.refund_of_id IS NOT NULL THEN
    BEGIN PERFORM public.reverse_loyalty(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'reverse_loyalty failed for %: %', NEW.id, SQLERRM;
    END;
    BEGIN PERFORM public.reverse_package_redemptions(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'reverse_package_redemptions failed for %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.grand_total,0) <= 0 OR NEW.status = 'refunded' THEN RETURN NEW; END IF;
  BEGIN PERFORM public.post_transaction_to_gl(NEW.id);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'post_transaction_to_gl: %', SQLERRM; END;
  BEGIN PERFORM public.post_service_consumption_to_gl(NEW.id);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'post_service_consumption_to_gl: %', SQLERRM; END;
  BEGIN PERFORM public.award_loyalty(NEW.id);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'award_loyalty: %', SQLERRM; END;
  RETURN NEW;
END $$;
