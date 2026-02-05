-- Add tenant_id to services table for multi-tenant isolation
ALTER TABLE public.services ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- Drop existing policy
DROP POLICY IF EXISTS "Services are publicly readable" ON public.services;

-- Create RLS policies for tenant-based access
CREATE POLICY "Users can view services in their tenant"
ON public.services FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create services in their tenant"
ON public.services FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update services in their tenant"
ON public.services FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()));