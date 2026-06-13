-- Backfill profiles.tenant_id (and branch_id) from earliest user_roles row
UPDATE public.profiles p
SET tenant_id = ur.tenant_id,
    branch_id = COALESCE(p.branch_id, (
      SELECT b.id FROM public.branches b
      WHERE b.tenant_id = ur.tenant_id AND b.is_active = true
      ORDER BY b.created_at ASC NULLS LAST
      LIMIT 1
    ))
FROM (
  SELECT DISTINCT ON (user_id) user_id, tenant_id
  FROM public.user_roles
  WHERE tenant_id IS NOT NULL
  ORDER BY user_id, created_at ASC NULLS LAST
) ur
WHERE p.user_id = ur.user_id
  AND p.tenant_id IS NULL;

-- Trigger function: auto-link profile to tenant when a role is assigned
CREATE OR REPLACE FUNCTION public.link_profile_tenant_on_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    UPDATE public.profiles p
    SET tenant_id = NEW.tenant_id,
        branch_id = COALESCE(p.branch_id, (
          SELECT b.id FROM public.branches b
          WHERE b.tenant_id = NEW.tenant_id AND b.is_active = true
          ORDER BY b.created_at ASC NULLS LAST
          LIMIT 1
        ))
    WHERE p.user_id = NEW.user_id
      AND p.tenant_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_profile_tenant_on_role ON public.user_roles;
CREATE TRIGGER trg_link_profile_tenant_on_role
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.link_profile_tenant_on_role();