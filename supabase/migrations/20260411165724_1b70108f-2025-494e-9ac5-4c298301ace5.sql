
CREATE TABLE IF NOT EXISTS public.po_approval_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  min_amount          NUMERIC(12,3) NOT NULL DEFAULT 0,
  max_amount          NUMERIC(12,3),
  allowed_roles       TEXT[] NOT NULL DEFAULT '{"owner","manager"}',
  specific_approvers  UUID[],
  require_two_approvers BOOLEAN NOT NULL DEFAULT false,
  four_eyes_enforced  BOOLEAN NOT NULL DEFAULT true,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_rules_tenant ON public.po_approval_rules(tenant_id, is_active, min_amount);

ALTER TABLE public.po_approval_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'po_approval_rules' AND policyname = 'po_rules_tenant_access') THEN
    CREATE POLICY "po_rules_tenant_access"
      ON public.po_approval_rules FOR ALL
      TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
      WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- Seed default rules for active tenants
INSERT INTO public.po_approval_rules (tenant_id, name, description, min_amount, max_amount, allowed_roles, sort_order)
SELECT id, 'Standard Approval', 'POs under 500 KWD — any manager or owner can approve', 0, 499.999, ARRAY['owner','manager'], 1
FROM public.tenants WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO public.po_approval_rules (tenant_id, name, description, min_amount, max_amount, allowed_roles, require_two_approvers, sort_order)
SELECT id, 'High-Value Approval', 'POs 500 KWD and above — owner approval required', 500, NULL, ARRAY['owner'], false, 2
FROM public.tenants WHERE is_active = true
ON CONFLICT DO NOTHING;
