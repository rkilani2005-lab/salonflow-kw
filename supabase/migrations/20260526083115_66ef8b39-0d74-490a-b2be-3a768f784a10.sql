
create extension if not exists pg_trgm;

alter table public.clients
  add column if not exists phone_norm text generated always as (
    regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  ) stored;

create unique index if not exists ux_clients_tenant_phone_norm
  on public.clients (tenant_id, phone_norm)
  where length(phone_norm) between 7 and 15;

create unique index if not exists ux_clients_tenant_email
  on public.clients (tenant_id, lower(email))
  where email is not null and length(trim(email)) > 0;

create index if not exists ix_clients_name_trgm
  on public.clients using gin (name gin_trgm_ops);

create or replace function public.merge_clients(p_primary uuid, p_duplicate uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary   public.clients%rowtype;
  v_duplicate public.clients%rowtype;
  v_caller_tenant uuid;
  v_moved_bookings int := 0;
  v_moved_conversations int := 0;
  v_moved_transactions int := 0;
begin
  v_caller_tenant := public.get_user_tenant_id(auth.uid());
  if v_caller_tenant is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  select * into v_primary   from public.clients where id = p_primary   for update;
  select * into v_duplicate from public.clients where id = p_duplicate for update;

  if v_primary.id is null or v_duplicate.id is null then
    raise exception 'one or both clients not found' using errcode = 'P0002';
  end if;
  if v_primary.tenant_id <> v_caller_tenant or v_duplicate.tenant_id <> v_caller_tenant then
    raise exception 'cannot merge clients from another tenant' using errcode = '42501';
  end if;
  if v_primary.id = v_duplicate.id then
    raise exception 'cannot merge a client with itself' using errcode = '22023';
  end if;

  update public.bookings      set client_id = p_primary where client_id = p_duplicate;
  get diagnostics v_moved_bookings = row_count;
  update public.conversations set client_id = p_primary where client_id = p_duplicate;
  get diagnostics v_moved_conversations = row_count;
  update public.transactions  set client_id = p_primary where client_id = p_duplicate;
  get diagnostics v_moved_transactions = row_count;

  begin update public.client_feedback      set client_id = p_primary where client_id = p_duplicate; exception when undefined_table then null; end;
  begin update public.client_packages      set client_id = p_primary where client_id = p_duplicate; exception when undefined_table then null; end;
  begin update public.client_portal_tokens set client_id = p_primary where client_id = p_duplicate; exception when undefined_table then null; end;
  begin update public.client_trigger_log   set client_id = p_primary where client_id = p_duplicate; exception when undefined_table then null; end;
  begin update public.loyalty_transactions set client_id = p_primary where client_id = p_duplicate; exception when undefined_table then null; end;
  begin update public.waiting_list         set client_id = p_primary where client_id = p_duplicate; exception when undefined_table then null; end;
  begin update public.ar_invoices          set client_id = p_primary where client_id = p_duplicate; exception when undefined_table then null; end;
  begin update public.journal_lines        set client_id = p_primary where client_id = p_duplicate; exception when undefined_table then null; end;

  update public.clients set
    email = coalesce(nullif(trim(coalesce(v_primary.email, '')), ''), v_duplicate.email),
    notes = case
      when coalesce(trim(v_primary.notes), '') = '' then v_duplicate.notes
      when coalesce(trim(v_duplicate.notes), '') = '' then v_primary.notes
      else v_primary.notes || E'\n\n[Merged from duplicate ' || v_duplicate.name || ']: ' || v_duplicate.notes
    end,
    tier = case
      when v_primary.tier = 'vvip' or v_duplicate.tier = 'vvip' then 'vvip'
      when v_primary.tier = 'vip'  or v_duplicate.tier = 'vip'  then 'vip'
      else 'normal'
    end,
    updated_at = now()
  where id = p_primary;

  delete from public.clients where id = p_duplicate;

  return json_build_object(
    'ok', true,
    'primary_id', p_primary,
    'merged_from', p_duplicate,
    'moved_bookings', v_moved_bookings,
    'moved_conversations', v_moved_conversations,
    'moved_transactions', v_moved_transactions
  );
end;
$$;

grant execute on function public.merge_clients(uuid, uuid) to authenticated;

create or replace function public.find_similar_clients(
  p_name  text default null,
  p_phone text default null,
  p_email text default null,
  p_limit int  default 5
)
returns table (
  id uuid, name text, phone text, email text, match_reason text, similarity real
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant      uuid;
  v_phone_norm  text;
  v_name_clean  text;
  v_email_clean text;
begin
  v_tenant := public.get_user_tenant_id(auth.uid());
  if v_tenant is null then return; end if;

  v_phone_norm  := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name_clean  := lower(trim(coalesce(p_name, '')));
  v_email_clean := lower(trim(coalesce(p_email, '')));

  return query
  with
    by_phone as (
      select c.id, c.name, c.phone, c.email, 'phone'::text as match_reason, 1.0::real as similarity
        from public.clients c
       where c.tenant_id = v_tenant
         and length(v_phone_norm) >= 7
         and right(c.phone_norm, 8) = right(v_phone_norm, 8)
       limit p_limit
    ),
    by_email as (
      select c.id, c.name, c.phone, c.email, 'email'::text as match_reason, 0.99::real as similarity
        from public.clients c
       where c.tenant_id = v_tenant
         and length(v_email_clean) > 0
         and lower(c.email) = v_email_clean
       limit p_limit
    ),
    by_name as (
      select c.id, c.name, c.phone, c.email, 'name'::text as match_reason,
             similarity(lower(c.name), v_name_clean)::real as similarity
        from public.clients c
       where c.tenant_id = v_tenant
         and length(v_name_clean) >= 3
         and similarity(lower(c.name), v_name_clean) >= 0.3
       order by similarity(lower(c.name), v_name_clean) desc
       limit p_limit
    )
  select id, name, phone, email, match_reason, similarity
    from (
      select * from by_phone
      union all select * from by_email
      union all select * from by_name
    ) combined
   order by similarity desc, match_reason
   limit p_limit;
end;
$$;

grant execute on function public.find_similar_clients(text, text, text, int) to authenticated;
