# D.6 — AI WhatsApp Agent (deployment notes)

This commit adds the AI auto-reply agent for WhatsApp conversations.
Code is shipped; **two manual steps** are required before it works
on the deployed Supabase project.

## What was shipped

- `supabase/functions/ai-reply/index.ts` — new edge function. Loads
  conversation history + tenant context, calls Claude with tool
  definitions for `check_availability`, `book_appointment`,
  `lookup_last_invoice`, sends the final reply via `channel-send`.
- `supabase/functions/baileys-inbound/index.ts` — fire-and-forget
  dispatch to `ai-reply` on every inbound text message.  The TODO
  Phase 5 placeholder is now wired.
- `supabase/migrations/20260504000001_d6_ai_handled_messages.sql` —
  adds `messages.ai_handled` (boolean, default false) and a partial
  index on pending-AI inbound messages.

## What you need to do in Lovable / Supabase

### 1. Set the Anthropic API key as an edge function secret

```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Or via the Supabase dashboard: Project Settings → Edge Functions →
Secrets → add `ANTHROPIC_API_KEY`.

The function fails closed if the key is missing — it'll respond with
"a team member will be with you shortly" rather than crash, but no
real AI replies will go out.

### 2. Apply the migration

`20260504000001_d6_ai_handled_messages.sql` adds one column and one
index.  Zero risk to existing data.  Run via Lovable's "Apply
migrations" button or `supabase db push`.

### 3. Deploy both edge functions

Both `ai-reply` (new) and `baileys-inbound` (modified) need to be
redeployed:

```sh
supabase functions deploy ai-reply
supabase functions deploy baileys-inbound
```

## Behaviour

For every inbound text message on a conversation where:
- `conversations.ai_handoff = true`  AND
- `channel_accounts.ai_agent_enabled = true`  AND
- the channel is `connected`  AND
- no staff member sent a message in the last 5 minutes

…the AI agent will:

1. Read the last 10 messages of context.
2. Build a system prompt with services, prices, staff list, hours,
   and the client's loyalty status.
3. Call Claude Haiku 4.5 with tool definitions.
4. Loop up to 5 hops as Claude calls tools (check availability →
   propose slots → wait for confirmation → book).
5. Send the final reply through the same `channel-send` path staff
   uses, so the message renders identically in the Inbox UI.
6. Mark the inbound message `ai_handled = true` (idempotency).

## Boundaries — what AI will NOT do

Hardcoded in the system prompt and reinforced by tool design:

- Cannot give discounts beyond what's in the system.
- Cannot cancel or modify existing appointments — explicitly tells
  the client a staff member will follow up.
- Refuses to discuss other clients' information.
- Treats complaints / refund requests / emotional messages as
  hand-offs to staff.
- Will NOT book without explicit client confirmation of service +
  date + time (system prompt rule).
- Will NOT book if the inbound number isn't linked to a registered
  client — the booking insert needs `client_id`, and the tool
  returns `client_not_registered` if missing.

## Cost shape

Claude Haiku 4.5 pricing applies.  A normal exchange — one client
question, AI replies — is one call (~500 input + ~150 output
tokens).  A booking flow is 3-4 calls (gather context → propose
slots → on confirmation, book → confirm done).

At Haiku rates, expect ~$0.001 per simple question, ~$0.005 per
booking.  A salon doing 50 inbound messages a day = ~$1.50/month.

## Cooldown logic — how human owners and AI coexist

Salons often have the owner's personal WhatsApp number paired.  If
the owner is actively typing replies on their phone, AI replies
will collide with theirs and look weird.

Solution: ai-reply checks `messages` for any outbound sent by
sender_type='staff' in the last 5 minutes.  If found, it skips
("staff_active") and stays quiet.  Threshold is intentionally
conservative — better to under-reply than fight the owner.

The AI resumes automatically as soon as 5 minutes pass without a
staff message.  No manual toggle needed.

## Future work (not in this commit)

- **D.7 — Invoice PDF auto-send.**  `lookupLastInvoice` returns the
  data but doesn't yet generate + send a PDF.  Tracked as a
  follow-up commit.
- **D.8 — Disconnection UX.**  When a Baileys session dies, the
  Settings → Channels page should show a "re-pair" banner.  Tracked
  separately.
- **Tenant-configurable opening hours.**  Currently hardcoded
  10:00-22:00 in both system prompt and `check_availability`.
  Should read from a tenant_settings table.
- **Multi-language tuning.**  System prompt instructs Claude to
  reply in the client's language.  Works well in practice with
  Haiku 4.5, but Arabic-only salons may want a forced Arabic mode.
