-- ============================================================================
-- Packages v2 — make the POS redemption entry point (redeem_package_for_item)
-- type-aware so the existing checkout flow works for ALL package types, not
-- just 'session'. Keeps the same signature + idempotency contract the POS
-- already relies on (one redemption per transaction_item, reversible on refund).
--
-- Behaviour by type:
--   session    : decrement sessions_remaining; deplete at 0           (unchanged)
--   membership : decrement sessions_remaining; never auto-deplete (refills)
--   unlimited  : eligible if service matches (or any-service); no decrement
--   bundle     : consume one matching client_package_items line
--   wallet     : NOT redeemed here — wallet is a payment method at POS, not a
--                per-line swap, so this returns false and the line is paid
--                normally. (Wallet debit is handled via its own path.)
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
  -- idempotent: already redeemed for this line
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

  -- ---- WALLET: not a per-line redemption ----
  IF v_pkg.package_type = 'wallet' THEN
    RETURN false;

  -- ---- BUNDLE: consume one matching item line ----
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

  -- ---- UNLIMITED: eligibility check only, no decrement ----
  ELSIF v_pkg.package_type = 'unlimited' OR v_pkg.is_unlimited THEN
    IF v_svc_pk.service_id IS NOT NULL AND v_svc_pk.service_id IS DISTINCT FROM v_item.item_id THEN
      RETURN false; -- package locked to a different service
    END IF;
    -- no counter change

  -- ---- SESSION & MEMBERSHIP: decrement counter ----
  ELSE
    -- service eligibility (session packs may be locked to one service; null = any)
    IF v_svc_pk.service_id IS NOT NULL AND v_svc_pk.service_id IS DISTINCT FROM v_item.item_id THEN
      RETURN false;
    END IF;
    v_remaining := COALESCE(v_pkg.sessions_remaining, v_pkg.sessions_total - COALESCE(v_pkg.sessions_used,0));
    UPDATE public.client_packages
       SET sessions_used = COALESCE(sessions_used,0) + 1,
           sessions_remaining = GREATEST(0, v_remaining - 1),
           -- membership refills next cycle, so it never auto-depletes here
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
