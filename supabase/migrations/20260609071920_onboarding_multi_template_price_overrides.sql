-- =====================================================================
-- Onboarding: multi-template support + per-service price overrides
-- =====================================================================
-- Extends provision_tenant_from_template to:
--   * accept multiple salon types via answers->'template_keys' (array),
--     while staying backward compatible with answers->>'template_key'
--   * accept an explicit list of services to create, each with its own
--     final price, via answers->'services':
--         [{ "name": "...", "name_ar": "...", "category": "hair",
--            "price": 9.000, "duration": 45 }, ...]
--     When 'services' is provided it is authoritative (the client has
--     already resolved selection, dedupe, tier, and manual price edits).
--     Falls back to the old template-default behaviour when absent.
--
-- Dedupe: services are deduped by lower(name) both within the payload
-- and against existing tenant services (first occurrence wins).
-- gl_category continues to map to the service_category key so it lines
-- up with the existing revenue_service gl_mappings. No new GL accounts.
-- =====================================================================

create or replace function public.provision_tenant_from_template(
  p_tenant_id uuid,
  p_answers   jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  -- template resolution (multi + legacy single)
  v_template_keys text[];
  v_template_ids  uuid[];
  v_first_key     text;

  v_tier         text := coalesce(p_answers->>'price_tier','mid');
  v_mult         numeric := 1.0;
  v_branch_id    uuid := nullif(p_answers->>'branch_id','')::uuid;
  v_opening      text := coalesce(p_answers->>'opening_time','10:00');
  v_closing      text := coalesce(p_answers->>'closing_time','22:00');
  v_working_days jsonb := coalesce(p_answers->'working_days', '["sat","sun","mon","tue","wed","thu"]'::jsonb);

  v_services_in  jsonb := p_answers->'services';          -- explicit (preferred)
  v_selected     jsonb := p_answers->'selected_services'; -- legacy names list

  v_services_made int := 0;
  v_roles_made    int := 0;
  v_cat          public.service_category;
  rec record;
  svc            jsonb;
begin
  -- ---- resolve templates (array first, then legacy single) ----
  if p_answers ? 'template_keys'
     and jsonb_typeof(p_answers->'template_keys') = 'array'
     and jsonb_array_length(p_answers->'template_keys') > 0 then
    select array_agg(value) into v_template_keys
    from jsonb_array_elements_text(p_answers->'template_keys');
  elsif p_answers->>'template_key' is not null then
    v_template_keys := array[p_answers->>'template_key'];
  else
    raise exception 'at least one template_key is required in answers';
  end if;

  select array_agg(id) into v_template_ids
  from public.salon_templates where template_key = any(v_template_keys);

  if v_template_ids is null or array_length(v_template_ids,1) = 0 then
    raise exception 'unknown template_keys: %', v_template_keys;
  end if;
  v_first_key := v_template_keys[1];

  v_mult := case v_tier
              when 'budget'  then 0.80
              when 'premium' then 1.30
              else 1.0
            end;

  -- chart of accounts + revenue_service mappings (idempotent)
  perform public.seed_salon_chart_of_accounts(p_tenant_id);

  -- =================================================================
  -- PATH A: explicit services payload (client already resolved
  -- selection / dedupe / tier / manual price edits)
  -- =================================================================
  if v_services_in is not null
     and jsonb_typeof(v_services_in) = 'array'
     and jsonb_array_length(v_services_in) > 0 then

    for svc in select * from jsonb_array_elements(v_services_in)
    loop
      -- validate category against the enum; default to 'other'
      begin
        v_cat := (svc->>'category')::public.service_category;
      exception when others then
        v_cat := 'other';
      end;

      if coalesce(svc->>'name','') <> ''
         and not exists (
           select 1 from public.services
           where tenant_id = p_tenant_id
             and lower(name) = lower(svc->>'name')
         ) then
        insert into public.services (
          tenant_id, name, name_ar, category, gl_category,
          price, duration, is_active
        ) values (
          p_tenant_id,
          svc->>'name',
          nullif(svc->>'name_ar',''),
          v_cat,
          v_cat::text,
          round(coalesce((svc->>'price')::numeric, 0), 3),
          coalesce((svc->>'duration')::int, 30),
          true
        );
        v_services_made := v_services_made + 1;
      end if;
    end loop;

  else
    -- =================================================================
    -- PATH B: legacy/template-default behaviour (dedupe by name across
    -- all selected templates; first occurrence wins)
    -- =================================================================
    for rec in
      select distinct on (lower(ts.name))
             ts.name, ts.name_ar, ts.category, ts.base_price, ts.duration
      from public.salon_template_services ts
      where ts.template_id = any(v_template_ids)
        and (
          v_selected is null or v_selected = 'null'::jsonb
          or ts.name in (select jsonb_array_elements_text(v_selected))
        )
        and (
          (v_selected is not null and v_selected <> 'null'::jsonb)
          or ts.is_default = true
        )
      order by lower(ts.name), ts.sort_order
    loop
      if not exists (
        select 1 from public.services
        where tenant_id = p_tenant_id and lower(name) = lower(rec.name)
      ) then
        insert into public.services (
          tenant_id, name, name_ar, category, gl_category,
          price, duration, is_active
        ) values (
          p_tenant_id, rec.name, rec.name_ar, rec.category,
          rec.category::text,
          round((rec.base_price * v_mult)::numeric, 3),
          rec.duration, true
        );
        v_services_made := v_services_made + 1;
      end if;
    end loop;
  end if;

  -- ---- STAFF role slots (deduped by name across templates) ----
  for rec in
    select distinct on (lower(tr.role_name))
           tr.role_name, tr.role_name_ar
    from public.salon_template_roles tr
    where tr.template_id = any(v_template_ids)
    order by lower(tr.role_name), tr.sort_order
  loop
    if not exists (
      select 1 from public.staff
      where tenant_id = p_tenant_id and lower(name) = lower(rec.role_name)
    ) then
      insert into public.staff (
        tenant_id, name, name_ar, is_active,
        working_hours_start, working_hours_end
      ) values (
        p_tenant_id, rec.role_name, rec.role_name_ar, true,
        (v_opening || ':00')::time, (v_closing || ':00')::time
      );
      v_roles_made := v_roles_made + 1;
    end if;
  end loop;

  -- ---- branch hours + working days ----
  if v_branch_id is not null then
    update public.branches
      set opening_time = (v_opening || ':00')::time,
          closing_time = (v_closing || ':00')::time,
          working_days = v_working_days,
          updated_at   = now()
    where id = v_branch_id and tenant_id = p_tenant_id;
  end if;

  -- ---- onboarding state ----
  insert into public.tenant_onboarding (tenant_id, status, answers, template_key, completed_at)
  values (p_tenant_id, 'completed', p_answers, v_first_key, now())
  on conflict (tenant_id) do update
    set status = 'completed', answers = excluded.answers,
        template_key = excluded.template_key, completed_at = now(), updated_at = now();

  return json_build_object(
    'success', true,
    'templates', to_jsonb(v_template_keys),
    'services_created', v_services_made,
    'staff_created', v_roles_made,
    'price_tier', v_tier
  );
end $$;

grant execute on function public.provision_tenant_from_template(uuid, jsonb) to authenticated;
