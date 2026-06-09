-- =====================================================================
-- Fix: onboarding RLS violation on tenants
-- =====================================================================
-- Root cause: a prior migration tightened the tenants SELECT policy to
--   USING (id = get_user_tenant_id(auth.uid()) OR is_super_admin(...))
-- The onboarding flow created the tenant with
--   insert(...).select().single()
-- which requires BOTH the INSERT WITH CHECK *and* the SELECT USING policy
-- to pass on the same statement. At insert time the caller's profile is
-- not yet linked to the new tenant, so get_user_tenant_id(auth.uid())
-- does not equal the new id, the read-back is denied, and PostgREST
-- surfaces it as an RLS violation on tenants.
--
-- Fix: do the whole bootstrap atomically inside a SECURITY DEFINER RPC
-- (tenant + first branch + profile link + owner role), returning the ids.
-- This sidesteps the chicken-and-egg and makes setup atomic.
-- =====================================================================

create or replace function public.bootstrap_tenant(
  p_salon_name    text,
  p_currency      text default 'KWD',
  p_branch_name   text default 'Main Branch',
  p_branch_address text default null,
  p_opening_time  text default '10:00',
  p_closing_time  text default '22:00',
  p_working_days  jsonb default '["sat","sun","mon","tue","wed","thu"]'::jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_tenant_id uuid;
  v_branch_id uuid;
  v_trial_end timestamptz := now() + interval '14 days';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Guard: if this user already has a tenant, return it instead of
  -- creating a duplicate (idempotent against double-submits).
  select tenant_id into v_tenant_id from public.profiles where user_id = v_uid;
  if v_tenant_id is not null then
    select id into v_branch_id from public.branches
      where tenant_id = v_tenant_id order by created_at limit 1;
    return json_build_object(
      'tenant_id', v_tenant_id, 'branch_id', v_branch_id, 'already_existed', true
    );
  end if;

  -- 1. tenant
  insert into public.tenants (name, currency, default_tax_rate,
                              onboarding_completed, is_trial, trial_ends_at)
  values (p_salon_name, p_currency, 0, true, true, v_trial_end)
  returning id into v_tenant_id;

  -- 2. first branch
  insert into public.branches (tenant_id, name, address, opening_time,
                               closing_time, working_days, is_active)
  values (v_tenant_id, p_branch_name, p_branch_address,
          (p_opening_time || ':00')::time, (p_closing_time || ':00')::time,
          p_working_days, true)
  returning id into v_branch_id;

  -- 3. link profile
  update public.profiles
     set tenant_id = v_tenant_id, branch_id = v_branch_id, updated_at = now()
   where user_id = v_uid;

  -- 4. owner role (idempotent)
  insert into public.user_roles (user_id, tenant_id, role)
  values (v_uid, v_tenant_id, 'owner')
  on conflict do nothing;

  return json_build_object(
    'tenant_id', v_tenant_id, 'branch_id', v_branch_id, 'already_existed', false
  );
end $$;

grant execute on function public.bootstrap_tenant(text, text, text, text, text, text, jsonb) to authenticated;
