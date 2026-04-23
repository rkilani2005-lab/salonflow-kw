-- =====================================================================
-- Phase 1 — Unified Inbox + Co-brand theming + Baileys-ready schema
-- (adapted: uses profiles table for tenant membership, not tenant_users)
-- =====================================================================

-- ---------- channel_accounts ----------------------------------------
create table if not exists public.channel_accounts (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  channel                 text not null check (channel in ('whatsapp','instagram','telegram','linkedin')),
  provider                text not null default 'baileys'
                          check (provider in ('baileys','unipile','meta_cloud','twilio','360dialog','green_api')),
  provider_account_id     text,
  display_handle          text,
  display_name            text,
  profile_pic_url         text,
  status                  text not null default 'disconnected'
                          check (status in ('disconnected','pending','connected','error','expired')),
  connected_at            timestamptz,
  last_sync_at            timestamptz,
  last_error              text,
  ice_breakers            jsonb default '[
    {"question":"Book an appointment","payload":"BOOK"},
    {"question":"See services & prices","payload":"SERVICES"},
    {"question":"Location & hours","payload":"LOCATION"},
    {"question":"Talk to a human","payload":"HUMAN"}
  ]'::jsonb,
  auto_reply_enabled      boolean not null default true,
  ai_agent_enabled        boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (tenant_id, channel)
);

create index if not exists idx_ch_account_tenant   on public.channel_accounts (tenant_id);
create index if not exists idx_ch_account_provider on public.channel_accounts (provider, provider_account_id);

-- ---------- conversations -------------------------------------------
create table if not exists public.conversations (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  channel_account_id      uuid references public.channel_accounts(id) on delete set null,
  channel                 text not null check (channel in ('whatsapp','instagram','telegram','linkedin')),
  provider_chat_id        text not null,
  external_id             text not null,
  client_id               uuid references public.clients(id) on delete set null,
  display_name            text,
  profile_pic_url         text,
  last_message_at         timestamptz default now(),
  last_message_preview    text,
  last_message_direction  text check (last_message_direction in ('inbound','outbound')),
  unread_count            integer not null default 0,
  status                  text not null default 'open'
                          check (status in ('open','pending','closed','spam')),
  assigned_to             uuid references auth.users(id) on delete set null,
  ai_handoff              boolean not null default true,
  tags                    text[] default '{}',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (tenant_id, channel, provider_chat_id)
);

create index if not exists idx_conv_tenant_last on public.conversations (tenant_id, last_message_at desc);
create index if not exists idx_conv_status      on public.conversations (tenant_id, status);
create index if not exists idx_conv_account     on public.conversations (channel_account_id);

-- ---------- messages ------------------------------------------------
create table if not exists public.messages (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  conversation_id      uuid not null references public.conversations(id) on delete cascade,
  direction            text not null check (direction in ('inbound','outbound')),
  sender_type          text not null check (sender_type in ('client','ai','staff','system')),
  sender_id            text,
  content_type         text not null default 'text'
                       check (content_type in ('text','image','audio','video','document','template','interactive','location','reaction')),
  content              text,
  media_url            text,
  external_message_id  text,
  status               text not null default 'sent'
                       check (status in ('queued','sent','delivered','read','failed')),
  error_message        text,
  booking_id           uuid references public.bookings(id) on delete set null,
  metadata             jsonb default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists idx_msg_conv on public.messages (conversation_id, created_at desc);
create unique index if not exists idx_msg_external_unique on public.messages (external_message_id)
  where external_message_id is not null;

-- ---------- tenant_theme --------------------------------------------
create table if not exists public.tenant_theme (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null unique references public.tenants(id) on delete cascade,
  brand_name           text not null,
  logo_url             text,
  logo_dark_url        text,
  favicon_url          text,
  primary_color        text not null default '#B8924A',
  primary_foreground   text not null default '#FFFFFF',
  accent_color         text not null default '#F5EFE7',
  bg_color             text not null default '#FFFFFF',
  text_color           text not null default '#1A1A1A',
  muted_color          text not null default '#6B7280',
  border_color         text not null default '#E5E7EB',
  font_heading         text not null default 'Playfair Display',
  font_body            text not null default 'Inter',
  font_arabic          text not null default 'Tajawal',
  show_powered_by      boolean not null default true,
  powered_by_text      text default 'Powered by ZAINA',
  powered_by_url       text default 'https://zaina.ai',
  whatsapp_link        text,
  instagram_handle     text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------- webhook_logs --------------------------------------------
create table if not exists public.webhook_logs (
  id            bigserial primary key,
  provider      text not null,
  event_type    text,
  account_id    text,
  tenant_id     uuid references public.tenants(id) on delete cascade,
  payload       jsonb not null,
  processed     boolean not null default false,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_wh_logs_created on public.webhook_logs (created_at desc);
create index if not exists idx_wh_logs_account on public.webhook_logs (account_id) where account_id is not null;

-- ---------- RLS (uses get_user_tenant_id security definer fn) -------
alter table public.channel_accounts enable row level security;
alter table public.conversations    enable row level security;
alter table public.messages         enable row level security;
alter table public.tenant_theme     enable row level security;
alter table public.webhook_logs     enable row level security;

create policy "ch_acc_tenant_all" on public.channel_accounts for all to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()))
  with check (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "conv_tenant_all" on public.conversations for all to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()))
  with check (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "msg_tenant_all" on public.messages for all to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()))
  with check (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "theme_read_public"  on public.tenant_theme for select using (true);
create policy "theme_write_tenant" on public.tenant_theme for all to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()))
  with check (tenant_id = public.get_user_tenant_id(auth.uid()));

create policy "wh_read_tenant" on public.webhook_logs for select to authenticated
  using (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ---------- Triggers ------------------------------------------------
create or replace function public.bump_conversation_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set last_message_at        = new.created_at,
         last_message_preview   = left(coalesce(new.content,'[media]'),120),
         last_message_direction = new.direction,
         unread_count = case when new.direction = 'inbound'
                             then unread_count + 1 else unread_count end,
         updated_at             = now()
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_bump_conv on public.messages;
create trigger trg_bump_conv after insert on public.messages
  for each row execute function public.bump_conversation_on_message();

create or replace function public.touch_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_conv_touch    on public.conversations;
drop trigger if exists trg_ch_acc_touch  on public.channel_accounts;
drop trigger if exists trg_theme_touch   on public.tenant_theme;

create trigger trg_conv_touch    before update on public.conversations    for each row execute function public.touch_updated_at();
create trigger trg_ch_acc_touch  before update on public.channel_accounts for each row execute function public.touch_updated_at();
create trigger trg_theme_touch   before update on public.tenant_theme     for each row execute function public.touch_updated_at();

-- ---------- Realtime publication ------------------------------------
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter table public.conversations replica identity full;
alter table public.messages      replica identity full;