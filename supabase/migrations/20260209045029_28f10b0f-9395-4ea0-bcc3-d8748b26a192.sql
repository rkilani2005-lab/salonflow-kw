-- The issue is the SELECT policy blocks returning inserted rows during onboarding
-- Update SELECT policy to also allow viewing the tenant being created (before profile is updated)
DROP POLICY IF EXISTS "Users can view tenants" ON public.tenants;

CREATE POLICY "Users can view tenants"
ON public.tenants
FOR SELECT
USING (
  id = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
  OR auth.uid() IS NOT NULL  -- Allow authenticated users to see tenants during creation
);