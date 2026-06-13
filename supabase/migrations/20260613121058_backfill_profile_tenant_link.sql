-- =====================================================================
-- Backfill: repair profiles missing tenant_id
-- =====================================================================
-- The whole app resolves a user's tenant via get_user_tenant_id(), which
-- reads ONLY profiles.tenant_id. Accounts created by the older non-atomic
-- onboarding (before bootstrap_tenant) can have a user_roles row pointing
-- at a tenant while profiles.tenant_id stayed null. Those users hit
-- "your account is not linked to a workspace" at upgrade/checkout and
-- silently fail tenant-scoped RLS reads elsewhere.
--
-- This backfills the link from the earliest user_roles row, and adds a
-- safety-net trigger so a future role insert auto-links the profile if it
-- is still missing a tenant.
-- =====================================================================

-- 1. One-time backfill
update public.profiles p
set    tenant_id = ur.tenant_id,
       updated_at = now()
from (
  select distinct on (user_id) user_id, tenant_id
  from public.user_roles
  where tenant_id is not null
  order by user_id, created_at asc
) ur
where p.user_id = ur.user_id
  and p.tenant_id is null;

-- Also link branch_id to the tenant's first branch where missing, so the
-- repaired profiles have a usable default branch.
update public.profiles p
set    branch_id = b.id
from   public.branches b
where  p.branch_id is null
  and  b.tenant_id = p.tenant_id
  and  b.id = (
        select id from public.branches
        where tenant_id = p.tenant_id
        order by created_at asc limit 1
       );

-- 2. Safety-net trigger: when a user_roles row is created, ensure the
--    matching profile is linked to that tenant if it isn't already.
create or replace function public.link_profile_tenant_on_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is not null then
    update public.profiles
       set tenant_id = coalesce(tenant_id, new.tenant_id),
           updated_at = now()
     where user_id = new.user_id
       and tenant_id is null;
  end if;
  return new;
end $$;

drop trigger if exists trg_link_profile_tenant_on_role on public.user_roles;
create trigger trg_link_profile_tenant_on_role
  after insert on public.user_roles
  for each row execute function public.link_profile_tenant_on_role();
