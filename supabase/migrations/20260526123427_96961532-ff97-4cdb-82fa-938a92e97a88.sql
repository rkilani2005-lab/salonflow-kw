
-- Fix 1: Make has_role tenant-scoped to prevent cross-tenant privilege escalation.
-- A user with 'owner' in tenant A but 'receptionist' in tenant B was passing
-- has_role checks while operating in tenant B. Now restrict to the user's
-- CURRENT tenant (as determined by their profile).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND ur.tenant_id = public.get_user_tenant_id(_user_id)
  )
$function$;

-- Fix 2: Restrict whatsapp_config SELECT to owner/manager (it stores live
-- access_token / webhook_verify_token).
DROP POLICY IF EXISTS "Users can view their tenant's WhatsApp config" ON public.whatsapp_config;
CREATE POLICY "Owners and managers can view WhatsApp config"
ON public.whatsapp_config
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.has_role(auth.uid(), 'manager'::app_role))
);

-- Fix 3: Block anonymous inserts into whatsapp_messages. The service_role
-- bypasses RLS, so this policy is only needed for authenticated callers
-- operating in their own tenant.
DROP POLICY IF EXISTS "Service role can insert messages" ON public.whatsapp_messages;
CREATE POLICY "Authenticated users can insert messages in their tenant"
ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_messages.conversation_id
      AND c.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);
