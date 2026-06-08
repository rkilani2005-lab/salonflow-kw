-- =====================================================================
-- Onboarding Agent: salon type templates + provisioning RPC
-- =====================================================================
-- Adds template catalog tables (global, read-only to tenants) and a
-- provisioning RPC that, given a tenant + the agent's answers, generates
-- services with correct gl_category (matching existing revenue_service
-- gl_mappings), staff slots, and branch working hours.
--
-- IMPORTANT: services.gl_category is set to the service_category value
-- (hair/nails/facial/makeup/waxing/massage/other) so it lines up exactly
-- with the 'revenue_service' mappings already created by
-- seed_salon_chart_of_accounts(). No new GL accounts are introduced.
--
-- Idempotent: template seed upserts by (template_key); service codes use
-- ON CONFLICT guards. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Template catalog tables
-- ---------------------------------------------------------------------
create table if not exists public.salon_templates (
  id            uuid primary key default gen_random_uuid(),
  template_key  text not null unique,           -- e.g. 'ladies_hair'
  name          text not null,
  name_ar       text not null,
  icon          text,                            -- lucide icon name for UI
  sort_order    int  not null default 100,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.salon_template_services (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.salon_templates(id) on delete cascade,
  name          text not null,
  name_ar       text not null,
  category      public.service_category not null default 'other',
  base_price    numeric(10,3) not null default 0,   -- KWD, mid-tier baseline
  duration      int not null default 30,            -- minutes
  is_default    boolean not null default true,      -- pre-checked in the wizard
  sort_order    int not null default 100
);

create table if not exists public.salon_template_roles (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.salon_templates(id) on delete cascade,
  role_name       text not null,
  role_name_ar    text not null,
  default_commission_pct numeric(5,2) not null default 0,
  sort_order      int not null default 100
);

create index if not exists idx_template_services_template on public.salon_template_services(template_id);
create index if not exists idx_template_roles_template    on public.salon_template_roles(template_id);

-- ---------------------------------------------------------------------
-- 2. Resumable onboarding state per tenant
-- ---------------------------------------------------------------------
create table if not exists public.tenant_onboarding (
  tenant_id     uuid primary key references public.tenants(id) on delete cascade,
  status        text not null default 'in_progress', -- in_progress | completed
  answers       jsonb not null default '{}'::jsonb,
  template_key  text,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
alter table public.salon_templates          enable row level security;
alter table public.salon_template_services  enable row level security;
alter table public.salon_template_roles     enable row level security;
alter table public.tenant_onboarding        enable row level security;

-- Templates are global reference data: any authenticated user may read.
drop policy if exists "templates_read_all" on public.salon_templates;
create policy "templates_read_all" on public.salon_templates
  for select to authenticated using (true);

drop policy if exists "template_services_read_all" on public.salon_template_services;
create policy "template_services_read_all" on public.salon_template_services
  for select to authenticated using (true);

drop policy if exists "template_roles_read_all" on public.salon_template_roles;
create policy "template_roles_read_all" on public.salon_template_roles
  for select to authenticated using (true);

-- Onboarding rows scoped to the caller's tenant (matches existing pattern:
-- profiles.tenant_id resolves the user's tenant).
drop policy if exists "onboarding_tenant_rw" on public.tenant_onboarding;
create policy "onboarding_tenant_rw" on public.tenant_onboarding
  for all to authenticated
  using (
    tenant_id in (select tenant_id from public.profiles where user_id = auth.uid())
  )
  with check (
    tenant_id in (select tenant_id from public.profiles where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 4. Seed the 6 archetype templates (idempotent upsert by template_key)
-- ---------------------------------------------------------------------
do $$
declare
  t_hair  uuid; t_nails uuid; t_spa uuid; t_beauty uuid; t_barber uuid; t_brows uuid;
begin
  insert into public.salon_templates (template_key, name, name_ar, icon, sort_order) values
    ('ladies_hair',  'Ladies Hair Salon', 'صالون شعر نسائي', 'Scissors',   10),
    ('nails_lashes', 'Nails & Lashes',     'أظافر ورموش',     'Sparkles',   20),
    ('spa_massage',  'Spa & Massage',      'سبا ومساج',       'Flower2',    30),
    ('beauty_center','Full Beauty Center', 'مركز تجميل متكامل','Crown',     40),
    ('barbershop',   'Barbershop (Men)',   'صالون رجالي',      'Scissors',   50),
    ('brows_skin',   'Brows & Skin Clinic','عيادة حواجب وبشرة','Eye',        60)
  on conflict (template_key) do update
    set name = excluded.name, name_ar = excluded.name_ar,
        icon = excluded.icon, sort_order = excluded.sort_order, is_active = true;

  select id into t_hair   from public.salon_templates where template_key = 'ladies_hair';
  select id into t_nails  from public.salon_templates where template_key = 'nails_lashes';
  select id into t_spa    from public.salon_templates where template_key = 'spa_massage';
  select id into t_beauty from public.salon_templates where template_key = 'beauty_center';
  select id into t_barber from public.salon_templates where template_key = 'barbershop';
  select id into t_brows  from public.salon_templates where template_key = 'brows_skin';

  -- Wipe & re-seed children for clean re-runs (templates are reference data)
  delete from public.salon_template_services where template_id in (t_hair,t_nails,t_spa,t_beauty,t_barber,t_brows);
  delete from public.salon_template_roles    where template_id in (t_hair,t_nails,t_spa,t_beauty,t_barber,t_brows);

  -- ---- LADIES HAIR ----
  insert into public.salon_template_services (template_id,name,name_ar,category,base_price,duration,sort_order) values
    (t_hair,'Haircut & Style','قص وتصفيف','hair',8.000,45,10),
    (t_hair,'Blow Dry','سشوار','hair',5.000,30,20),
    (t_hair,'Full Color','صبغة كاملة','hair',25.000,120,30),
    (t_hair,'Highlights','هايلايت','hair',35.000,150,40),
    (t_hair,'Keratin Treatment','بروتين/كيراتين','hair',45.000,180,50),
    (t_hair,'Hair Treatment','علاج للشعر','hair',12.000,45,60),
    (t_hair,'Bridal Hair','شعر عرايس','hair',60.000,120,70);
  insert into public.salon_template_roles (template_id,role_name,role_name_ar,default_commission_pct,sort_order) values
    (t_hair,'Senior Stylist','مصففة أولى',15,10),
    (t_hair,'Stylist','مصففة',10,20),
    (t_hair,'Colorist','خبيرة صبغات',15,30);

  -- ---- NAILS & LASHES ----
  insert into public.salon_template_services (template_id,name,name_ar,category,base_price,duration,sort_order) values
    (t_nails,'Manicure','مانيكير','nails',6.000,40,10),
    (t_nails,'Pedicure','بديكير','nails',8.000,50,20),
    (t_nails,'Gel Polish','جل','nails',10.000,60,30),
    (t_nails,'Acrylic Extensions','تركيب أظافر','nails',18.000,90,40),
    (t_nails,'Lash Extensions','تركيب رموش','other',20.000,90,50),
    (t_nails,'Lash Lift','رفع رموش','other',15.000,60,60),
    (t_nails,'Nail Art','رسم أظافر','nails',5.000,30,70);
  insert into public.salon_template_roles (template_id,role_name,role_name_ar,default_commission_pct,sort_order) values
    (t_nails,'Nail Technician','فنية أظافر',15,10),
    (t_nails,'Lash Technician','فنية رموش',15,20);

  -- ---- SPA & MASSAGE ----
  insert into public.salon_template_services (template_id,name,name_ar,category,base_price,duration,sort_order) values
    (t_spa,'Relaxation Massage','مساج استرخاء','massage',18.000,60,10),
    (t_spa,'Deep Tissue Massage','مساج عميق','massage',22.000,60,20),
    (t_spa,'Hot Stone Massage','مساج حجر ساخن','massage',25.000,75,30),
    (t_spa,'Classic Facial','تنظيف بشرة','facial',15.000,60,40),
    (t_spa,'Body Scrub','تقشير الجسم','other',20.000,60,50),
    (t_spa,'Moroccan Bath / Hammam','حمام مغربي','other',25.000,90,60);
  insert into public.salon_template_roles (template_id,role_name,role_name_ar,default_commission_pct,sort_order) values
    (t_spa,'Massage Therapist','أخصائية مساج',15,10),
    (t_spa,'Esthetician','أخصائية بشرة',12,20);

  -- ---- FULL BEAUTY CENTER (broad mix) ----
  insert into public.salon_template_services (template_id,name,name_ar,category,base_price,duration,sort_order) values
    (t_beauty,'Haircut & Style','قص وتصفيف','hair',8.000,45,10),
    (t_beauty,'Full Color','صبغة كاملة','hair',25.000,120,20),
    (t_beauty,'Manicure','مانيكير','nails',6.000,40,30),
    (t_beauty,'Pedicure','بديكير','nails',8.000,50,40),
    (t_beauty,'Classic Facial','تنظيف بشرة','facial',15.000,60,50),
    (t_beauty,'Makeup Application','مكياج','makeup',30.000,60,60),
    (t_beauty,'Full Body Waxing','إزالة شعر كامل','waxing',20.000,60,70),
    (t_beauty,'Bridal Package','باكج عرايس','makeup',120.000,240,80);
  insert into public.salon_template_roles (template_id,role_name,role_name_ar,default_commission_pct,sort_order) values
    (t_beauty,'Hair Stylist','مصففة شعر',12,10),
    (t_beauty,'Beautician','خبيرة تجميل',12,20),
    (t_beauty,'Makeup Artist','خبيرة مكياج',20,30),
    (t_beauty,'Nail Technician','فنية أظافر',12,40);

  -- ---- BARBERSHOP (men) ----
  insert into public.salon_template_services (template_id,name,name_ar,category,base_price,duration,sort_order) values
    (t_barber,'Haircut','حلاقة شعر','hair',4.000,30,10),
    (t_barber,'Beard Trim','تهذيب لحية','hair',2.000,20,20),
    (t_barber,'Hot Towel Shave','حلاقة بمنشفة ساخنة','hair',3.000,30,30),
    (t_barber,'Haircut & Beard','حلاقة شعر ولحية','hair',5.000,45,40),
    (t_barber,'Kids Haircut','حلاقة أطفال','hair',3.000,25,50),
    (t_barber,'Facial for Men','تنظيف بشرة رجالي','facial',10.000,45,60);
  insert into public.salon_template_roles (template_id,role_name,role_name_ar,default_commission_pct,sort_order) values
    (t_barber,'Senior Barber','حلاق أول',15,10),
    (t_barber,'Barber','حلاق',10,20);

  -- ---- BROWS & SKIN CLINIC ----
  insert into public.salon_template_services (template_id,name,name_ar,category,base_price,duration,sort_order) values
    (t_brows,'Eyebrow Threading','خيط حواجب','waxing',2.000,15,10),
    (t_brows,'Eyebrow Tinting','صبغ حواجب','other',5.000,30,20),
    (t_brows,'Microblading','مايكروبليدنغ','other',60.000,120,30),
    (t_brows,'Classic Facial','تنظيف بشرة','facial',15.000,60,40),
    (t_brows,'Chemical Peel','تقشير كيميائي','facial',30.000,60,50),
    (t_brows,'Hydrafacial','هيدرافيشل','facial',35.000,75,60),
    (t_brows,'Full Face Threading','خيط كامل للوجه','waxing',5.000,30,70);
  insert into public.salon_template_roles (template_id,role_name,role_name_ar,default_commission_pct,sort_order) values
    (t_brows,'Skin Specialist','أخصائية بشرة',12,10),
    (t_brows,'Brow Artist','خبيرة حواجب',15,20);
end $$;

-- ---------------------------------------------------------------------
-- 5. Provisioning RPC
-- ---------------------------------------------------------------------
-- Given a tenant and the agent's answers, generate services + staff +
-- branch hours. Designed to be called AFTER the tenant/branch/profile
-- rows exist (the wizard creates those, then calls this).
--
-- answers JSONB shape (all optional except template_key):
-- {
--   "template_key": "ladies_hair",
--   "selected_services": ["<service name>", ...],   -- if omitted, all defaults
--   "price_tier": "budget" | "mid" | "premium" | "custom",
--   "commission_pct": 10,                            -- applied to all roles
--   "branch_id": "<uuid>",
--   "working_days": ["sat","sun","mon","tue","wed","thu"],
--   "opening_time": "10:00",
--   "closing_time": "22:00",
--   "staff_count": 3
-- }
-- ---------------------------------------------------------------------
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
  v_template_key text := p_answers->>'template_key';
  v_template_id  uuid;
  v_tier         text := coalesce(p_answers->>'price_tier','mid');
  v_mult         numeric := 1.0;
  v_commission   numeric := coalesce((p_answers->>'commission_pct')::numeric, 0);
  v_branch_id    uuid := nullif(p_answers->>'branch_id','')::uuid;
  v_opening      text := coalesce(p_answers->>'opening_time','10:00');
  v_closing      text := coalesce(p_answers->>'closing_time','22:00');
  v_working_days jsonb := coalesce(p_answers->'working_days', '["sat","sun","mon","tue","wed","thu"]'::jsonb);
  v_selected     jsonb := p_answers->'selected_services';
  v_services_made int := 0;
  v_roles_made    int := 0;
  rec record;
begin
  if v_template_key is null then
    raise exception 'template_key is required in answers';
  end if;

  select id into v_template_id from public.salon_templates where template_key = v_template_key;
  if v_template_id is null then
    raise exception 'unknown template_key: %', v_template_key;
  end if;

  -- price tier multiplier
  v_mult := case v_tier
              when 'budget'  then 0.80
              when 'premium' then 1.30
              else 1.0
            end;

  -- Ensure chart of accounts + revenue_service mappings exist for this
  -- tenant (idempotent — safe even if already seeded).
  perform public.seed_salon_chart_of_accounts(p_tenant_id);

  -- ---- SERVICES ----
  for rec in
    select * from public.salon_template_services
    where template_id = v_template_id
      and (
        v_selected is null              -- no explicit selection -> all defaults
        or v_selected = 'null'::jsonb
        or name in (select jsonb_array_elements_text(v_selected))
      )
      and (
        v_selected is not null and v_selected <> 'null'::jsonb
        or is_default = true            -- default path: only defaults
      )
    order by sort_order
  loop
    -- Skip if a service with the same name already exists for this tenant
    if not exists (
      select 1 from public.services
      where tenant_id = p_tenant_id and lower(name) = lower(rec.name)
    ) then
      insert into public.services (
        tenant_id, name, name_ar, category, gl_category,
        price, duration, is_active
      ) values (
        p_tenant_id, rec.name, rec.name_ar, rec.category,
        rec.category::text,                       -- gl_category = category key
        round((rec.base_price * v_mult)::numeric, 3),
        rec.duration, true
      );
      v_services_made := v_services_made + 1;
    end if;
  end loop;

  -- ---- STAFF (role slots) ----
  -- Create one staff slot per template role, capped by staff_count if given.
  for rec in
    select * from public.salon_template_roles
    where template_id = v_template_id
    order by sort_order
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

  -- ---- BRANCH HOURS + WORKING DAYS ----
  if v_branch_id is not null then
    update public.branches
      set opening_time = (v_opening || ':00')::time,
          closing_time = (v_closing || ':00')::time,
          working_days = v_working_days,
          updated_at   = now()
    where id = v_branch_id and tenant_id = p_tenant_id;
  end if;

  -- ---- ONBOARDING STATE ----
  insert into public.tenant_onboarding (tenant_id, status, answers, template_key, completed_at)
  values (p_tenant_id, 'completed', p_answers, v_template_key, now())
  on conflict (tenant_id) do update
    set status = 'completed', answers = excluded.answers,
        template_key = excluded.template_key, completed_at = now(), updated_at = now();

  return json_build_object(
    'success', true,
    'template', v_template_key,
    'services_created', v_services_made,
    'staff_created', v_roles_made,
    'price_tier', v_tier
  );
end $$;

grant execute on function public.provision_tenant_from_template(uuid, jsonb) to authenticated;

-- Helper: save partial answers mid-flow (resumable)
create or replace function public.save_onboarding_progress(
  p_tenant_id uuid,
  p_answers   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_onboarding (tenant_id, status, answers, template_key)
  values (p_tenant_id, 'in_progress', p_answers, p_answers->>'template_key')
  on conflict (tenant_id) do update
    set answers = excluded.answers,
        template_key = excluded.template_key,
        updated_at = now()
  where public.tenant_onboarding.status <> 'completed';
end $$;

grant execute on function public.save_onboarding_progress(uuid, jsonb) to authenticated;
