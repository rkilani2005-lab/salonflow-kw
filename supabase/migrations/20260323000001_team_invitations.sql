-- ============================================================
-- Team / Portal User Management
-- Tenants invite users by email; plan limits enforced
-- ============================================================

-- ── Invitation tracking table ─────────────────────────────────
CREATE TABLE public.tenant_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'receptionist',
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | revoked | expired
  invited_by    UUID REFERENCES auth.users(id),
  token         UUID NOT NULL DEFAULT gen_random_uuid(),  -- used in email link
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '72 hours',
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_invitations_tenant  ON public.tenant_invitations(tenant_id, status);
CREATE INDEX idx_invitations_token   ON public.tenant_invitations(token);
CREATE INDEX idx_invitations_email   ON public.tenant_invitations(email);

-- RLS
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view invitations"
ON public.tenant_invitations FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tenant_id = tenant_invitations.tenant_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Owners and managers can manage invitations"
ON public.tenant_invitations FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE r.user_id = auth.uid()
    AND r.tenant_id = tenant_invitations.tenant_id
    AND r.role IN ('owner','manager')
  )
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE r.user_id = auth.uid()
    AND r.tenant_id = tenant_invitations.tenant_id
    AND r.role IN ('owner','manager')
  )
  OR is_super_admin(auth.uid())
);

-- ── Plan user limits (enforced in app layer) ──────────────────
-- starter: 3 portal users max
-- professional: 10 portal users max
-- ai: unlimited (9999)
CREATE OR REPLACE FUNCTION public.get_plan_user_limit(p_plan TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_plan
    WHEN 'starter'      THEN 3
    WHEN 'professional' THEN 10
    WHEN 'ai'           THEN 9999
    ELSE 3
  END;
$$;

-- ── Count active portal users for a tenant ───────────────────
CREATE OR REPLACE FUNCTION public.count_tenant_users(p_tenant_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(DISTINCT user_id)::INTEGER
  FROM public.user_roles
  WHERE tenant_id = p_tenant_id
  AND role != 'super_admin';
$$;
