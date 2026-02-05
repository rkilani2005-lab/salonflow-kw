-- Create a function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Update RLS policies to allow super_admin access to all tenants
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view tenants" ON public.tenants
FOR SELECT USING (
  id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own tenant" ON public.tenants;
CREATE POLICY "Users can update tenants" ON public.tenants
FOR UPDATE USING (
  id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
);

-- Allow super_admin to view all profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT USING (
  user_id = auth.uid() OR is_super_admin(auth.uid())
);

-- Allow super_admin to view all branches
DROP POLICY IF EXISTS "Users can view branches in their tenant" ON public.branches;
CREATE POLICY "Users can view branches" ON public.branches
FOR SELECT USING (
  tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
);

-- Allow super_admin to view all clients
DROP POLICY IF EXISTS "Users can view clients in their tenant" ON public.clients;
CREATE POLICY "Users can view clients" ON public.clients
FOR SELECT USING (
  tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
);

-- Allow super_admin to view all staff
DROP POLICY IF EXISTS "Users can view staff in their tenant" ON public.staff;
CREATE POLICY "Users can view staff" ON public.staff
FOR SELECT USING (
  tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
);

-- Allow super_admin to view all services
DROP POLICY IF EXISTS "Users can view services in their tenant" ON public.services;
CREATE POLICY "Users can view services" ON public.services
FOR SELECT USING (
  tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
);

-- Allow super_admin to view all user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view roles" ON public.user_roles
FOR SELECT USING (
  user_id = auth.uid() OR is_super_admin(auth.uid())
);

-- Allow super_admin to update user_roles
CREATE POLICY "Super admin can update roles" ON public.user_roles
FOR UPDATE USING (is_super_admin(auth.uid()));

-- Allow super_admin to delete user_roles  
CREATE POLICY "Super admin can delete roles" ON public.user_roles
FOR DELETE USING (is_super_admin(auth.uid()));