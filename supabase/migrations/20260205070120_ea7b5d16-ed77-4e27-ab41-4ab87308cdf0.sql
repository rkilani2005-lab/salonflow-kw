-- Add UPDATE policy for clients table
CREATE POLICY "Clients can be updated"
ON public.clients
FOR UPDATE
USING (true);

-- Add tenant_id column to clients for proper multi-tenant isolation
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Update RLS policies to be tenant-aware
DROP POLICY IF EXISTS "Anyone can create a client" ON public.clients;
DROP POLICY IF EXISTS "Clients are publicly readable" ON public.clients;
DROP POLICY IF EXISTS "Clients can be updated" ON public.clients;

CREATE POLICY "Users can view clients in their tenant"
ON public.clients
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create clients in their tenant"
ON public.clients
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update clients in their tenant"
ON public.clients
FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()));