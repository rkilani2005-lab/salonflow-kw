-- Add tenant_id to staff table for multi-tenant isolation
ALTER TABLE public.staff ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- Drop existing policy
DROP POLICY IF EXISTS "Active staff are publicly readable" ON public.staff;

-- Create RLS policies for tenant-based access
CREATE POLICY "Users can view staff in their tenant"
ON public.staff FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create staff in their tenant"
ON public.staff FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update staff in their tenant"
ON public.staff FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add RLS policies for staff_services
DROP POLICY IF EXISTS "Staff services are publicly readable" ON public.staff_services;

CREATE POLICY "Users can view staff services via staff tenant"
ON public.staff_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff s 
    WHERE s.id = staff_id AND s.tenant_id = get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "Users can manage staff services via staff tenant"
ON public.staff_services FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff s 
    WHERE s.id = staff_id AND s.tenant_id = get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "Users can delete staff services via staff tenant"
ON public.staff_services FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.staff s 
    WHERE s.id = staff_id AND s.tenant_id = get_user_tenant_id(auth.uid())
  )
);