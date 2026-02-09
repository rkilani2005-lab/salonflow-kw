-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

-- Recreate as PERMISSIVE (default) so authenticated users can create tenants
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);