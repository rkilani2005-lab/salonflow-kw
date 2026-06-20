-- Restrict tenant_invitations SELECT to owners/managers (token is sensitive)
DROP POLICY IF EXISTS "Tenant members can view invitations" ON public.tenant_invitations;

-- Allow owners to delete WhatsApp config (was missing)
DROP POLICY IF EXISTS "Owners can delete WhatsApp config" ON public.whatsapp_config;
CREATE POLICY "Owners can delete WhatsApp config"
ON public.whatsapp_config
FOR DELETE
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
);
