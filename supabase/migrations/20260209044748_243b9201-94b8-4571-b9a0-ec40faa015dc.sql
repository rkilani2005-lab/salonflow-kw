-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

-- Recreate INSERT policy without role restriction (uses default public)
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);