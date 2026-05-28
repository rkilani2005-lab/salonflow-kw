-- Atomic, max_uses-aware promo usage increment.
-- Returns TRUE if successfully incremented, FALSE if already at max_uses.
CREATE OR REPLACE FUNCTION public.increment_promo_usage(p_promo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.promo_codes
     SET used_count = COALESCE(used_count, 0) + 1
   WHERE id = p_promo_id
     AND is_active = true
     AND (expires_at IS NULL OR expires_at >= now())
     AND (max_uses IS NULL OR COALESCE(used_count, 0) < max_uses);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_promo_usage(uuid) TO authenticated, service_role;