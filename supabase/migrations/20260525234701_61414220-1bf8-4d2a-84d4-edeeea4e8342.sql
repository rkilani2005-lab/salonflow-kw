
-- 1. payment_transactions: fix broken join
DROP POLICY IF EXISTS "Authenticated users can view payment transactions via booking t" ON public.payment_transactions;
CREATE POLICY "Tenant users can view payment transactions"
  ON public.payment_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = payment_transactions.booking_id
        AND b.tenant_id = public.get_user_tenant_id(auth.uid())
    )
    OR public.is_super_admin(auth.uid())
  );

-- 2. tenants: remove the (auth.uid() IS NOT NULL) branch
DROP POLICY IF EXISTS "Users can view tenants" ON public.tenants;
CREATE POLICY "Users can view tenants"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (
    id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- 3. client_portal_tokens: lock to service_role only
DROP POLICY IF EXISTS "Public token lookup" ON public.client_portal_tokens;
DROP POLICY IF EXISTS "Service role inserts tokens" ON public.client_portal_tokens;
CREATE POLICY "Service role full access to client_portal_tokens"
  ON public.client_portal_tokens FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 4. services: remove anonymous catalogue read (public booking uses edge function)
DROP POLICY IF EXISTS "Anon can view active services" ON public.services;

-- 5. Convert views to security_invoker so RLS of the caller is enforced
ALTER VIEW public.transaction_tip_rollup_v1 SET (security_invoker = on);
ALTER VIEW public.consumption_variance_v1   SET (security_invoker = on);
ALTER VIEW public.transaction_payers_v1     SET (security_invoker = on);
ALTER VIEW public.usage_variance_v1         SET (security_invoker = on);

-- 6. Realtime authorization: scope channel topics by tenant
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read their realtime topics" ON realtime.messages;
CREATE POLICY "Tenant users can read their realtime topics"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE ('tenant:' || public.get_user_tenant_id(auth.uid())::text || ':%')
  );

DROP POLICY IF EXISTS "Tenant users can broadcast on their realtime topics" ON realtime.messages;
CREATE POLICY "Tenant users can broadcast on their realtime topics"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE ('tenant:' || public.get_user_tenant_id(auth.uid())::text || ':%')
  );

-- 7. Fix search_path on update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 8. Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bookings_set_tenant_id()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_conversation_on_message()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_po_number()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_grn_number()             FROM PUBLIC, anon, authenticated;
