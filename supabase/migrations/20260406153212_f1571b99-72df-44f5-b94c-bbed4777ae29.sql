
-- 1. Fix payment_transactions: remove overly permissive policy, add proper scoping
DROP POLICY IF EXISTS "Payment transactions are service-level only" ON public.payment_transactions;

CREATE POLICY "Service role full access to payment_transactions"
ON public.payment_transactions FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view payment transactions via booking tenant"
ON public.payment_transactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM bookings b
    JOIN profiles p ON p.tenant_id IS NOT NULL
    WHERE b.id = payment_transactions.booking_id
    AND p.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
);

-- 2. Fix user_roles: remove dangerous self-assignment policy, add restricted one
DROP POLICY IF EXISTS "Authenticated users can create their own roles" ON public.user_roles;

CREATE POLICY "Users can only self-assign basic roles in their tenant"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND tenant_id = get_user_tenant_id(auth.uid())
  AND role NOT IN ('super_admin', 'owner', 'manager')
);

CREATE POLICY "Super admins can insert any role"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
);

-- 3. Fix bookings: add tenant scoping to INSERT and UPDATE
DROP POLICY IF EXISTS "Users can create bookings in their tenant" ON public.bookings;
DROP POLICY IF EXISTS "Users can update bookings in their tenant" ON public.bookings;

CREATE POLICY "Users can create bookings in their tenant"
ON public.bookings FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update bookings in their tenant"
ON public.bookings FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.tenant_id IS NOT NULL
  )
  OR is_super_admin(auth.uid())
);

-- 4. Fix whatsapp_conversations: restrict INSERT/UPDATE to service_role only
DROP POLICY IF EXISTS "Service role can insert conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Service role can update conversations" ON public.whatsapp_conversations;

CREATE POLICY "Service role can insert conversations"
ON public.whatsapp_conversations FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update conversations"
ON public.whatsapp_conversations FOR UPDATE TO service_role
USING (true);
