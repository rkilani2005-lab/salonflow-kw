alter table public.messages
  add column if not exists ai_handled boolean not null default false;

create index if not exists idx_messages_ai_pending
  on public.messages (conversation_id)
  where direction = 'inbound' and ai_handled = false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy "Tenant SELECT on invoices bucket"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
  );