
-- Allow anon users to read active services (needed for public booking page)
CREATE POLICY "Anon can view active services"
ON public.services FOR SELECT
TO anon
USING (is_active = true);

-- Allow anon users to read active staff (needed for public booking page)  
CREATE POLICY "Anon can view active staff"
ON public.staff FOR SELECT
TO anon
USING (is_active = true);

-- Remove overly permissive booking policies
DROP POLICY IF EXISTS "Anyone can create a booking" ON public.bookings;
DROP POLICY IF EXISTS "Bookings are publicly readable" ON public.bookings;
DROP POLICY IF EXISTS "Bookings can be updated" ON public.bookings;

-- Bookings: authenticated users can read their tenant's bookings
CREATE POLICY "Users can view bookings in their tenant"
ON public.bookings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.tenant_id IS NOT NULL
  )
  OR is_super_admin(auth.uid())
);

-- Bookings: authenticated users can insert for their tenant
CREATE POLICY "Users can create bookings in their tenant"
ON public.bookings FOR INSERT
TO authenticated
WITH CHECK (true);

-- Bookings: authenticated users can update
CREATE POLICY "Users can update bookings in their tenant"
ON public.bookings FOR UPDATE
TO authenticated
USING (true);

-- Service role can do everything on bookings (for edge functions)
CREATE POLICY "Service role full access to bookings"
ON public.bookings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Service role can insert clients (for edge function)
CREATE POLICY "Service role can manage clients"
ON public.clients FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
