
DROP POLICY IF EXISTS "Users can create staff in their tenant" ON public.staff;
DROP POLICY IF EXISTS "Users can update staff in their tenant" ON public.staff;
DROP POLICY IF EXISTS "Users can delete staff in their tenant" ON public.staff;

CREATE POLICY "Owners/managers can create staff in their tenant"
  ON public.staff FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Owners/managers can update staff in their tenant"
  ON public.staff FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Owners/managers can delete staff in their tenant"
  ON public.staff FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "Users can create services in their tenant" ON public.services;
DROP POLICY IF EXISTS "Users can update services in their tenant" ON public.services;

CREATE POLICY "Owners/managers can create services in their tenant"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Owners/managers can update services in their tenant"
  ON public.services FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

DROP POLICY IF EXISTS "Users can create clients in their tenant" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients in their tenant" ON public.clients;

CREATE POLICY "Operational roles can create clients in their tenant"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'receptionist'::app_role)
      OR has_role(auth.uid(), 'cashier'::app_role)
      OR has_role(auth.uid(), 'stylist'::app_role)));

CREATE POLICY "Operational roles can update clients in their tenant"
  ON public.clients FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'receptionist'::app_role)
      OR has_role(auth.uid(), 'cashier'::app_role)
      OR has_role(auth.uid(), 'stylist'::app_role)))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'receptionist'::app_role)
      OR has_role(auth.uid(), 'cashier'::app_role)
      OR has_role(auth.uid(), 'stylist'::app_role)));

DROP POLICY IF EXISTS "Owners and managers can assign roles in their tenant" ON public.user_roles;

CREATE POLICY "Owners and managers can assign roles in their tenant"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND role <> 'super_admin'::app_role
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR (
        has_role(auth.uid(), 'manager'::app_role)
        AND role <> 'owner'::app_role
        AND role <> 'manager'::app_role
      )
    )
  );
