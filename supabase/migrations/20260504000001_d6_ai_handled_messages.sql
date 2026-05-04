-- ====================================================================
-- D.6  AI agent — schema additions
-- ====================================================================
-- The ai-reply edge function needs an idempotency marker on incoming
-- messages so a retry of baileys-inbound (e.g. on dedupe race) doesn't
-- get the AI to double-respond to the same client message.
--
-- Defaults to false; ai-reply flips it true after dispatching the
-- final reply, even if no actual outbound message was sent (e.g. AI
-- decided to stay quiet because the message was a sticker reaction
-- or a thank-you).  Once flipped, the message is owned by AI for
-- evaluation purposes — staff can still reply manually.
-- ====================================================================

alter table public.messages
  add column if not exists ai_handled boolean not null default false;

create index if not exists idx_messages_ai_pending
  on public.messages (conversation_id)
  where direction = 'inbound' and ai_handled = false;
-- Partial index so the AI handler / dashboards can quickly find
-- pending-AI work without scanning all messages.
