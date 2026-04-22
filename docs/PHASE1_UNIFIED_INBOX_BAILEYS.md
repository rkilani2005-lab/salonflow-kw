# Phase 1c — Self-hosted Baileys (zero external cost)

Architecture:

```
┌─────────────┐      HTTP + X-Baileys-Auth     ┌──────────────────┐
│  Supabase   │ ◀─────────────────────────────▶│  Baileys Node    │
│  (DB + Edge │      POST /sessions/:id/start  │  Service         │
│  Functions) │ ─────────────────────────────▶ │  (Express + Bail)│
│             │      POST /sessions/:id/msgs   │                  │
│             │ ◀──────── webhook events ──── ◀│  WS ─▶ WhatsApp  │
└─────────────┘                                 └──────────────────┘
```

## 0. Apply the migration delta

```sql
-- supabase/migrations/20260423000003_baileys_provider.sql
```

This adds `'baileys'` to the provider enum and makes it the default. Safe to run on top of the previous migration.

## 1. Deploy the Baileys service (when you're ready)

You have three paths, roughly ordered from easiest to cheapest:

**Railway** (recommended to start, ~$5/mo, zero ops):
```
# One-time
railway login
railway init
railway up
# Add a volume in the dashboard pointing to /app/auth — critical, this is the WhatsApp auth state
```

**Render** (similar, ~$7/mo for persistent disk)

**Hetzner / Contabo VPS** (~$4/mo, you SSH in):
```
ssh root@your-vps
git clone <your-repo>
cd baileys-service
npm ci && npm run build
pm2 start dist/index.js --name zaina-baileys
pm2 save && pm2 startup
```

Set these env vars wherever you deploy:
```
PORT=3001
AUTH_DIR=/app/auth                           # persistent volume
BAILEYS_SHARED_SECRET=<random-32-char-string>
SUPABASE_WEBHOOK_URL=https://<your-project>.supabase.co/functions/v1/baileys-inbound
SUPABASE_WEBHOOK_SECRET=<another-random-string>
```

## 2. Supabase edge functions env vars

In Supabase → Settings → Edge Functions → Secrets:
```
BAILEYS_SERVICE_URL=https://your-baileys.up.railway.app
BAILEYS_SHARED_SECRET=<same as above>
SUPABASE_WEBHOOK_SECRET=<same as above>
```

## 3. Deploy the edge functions

```
supabase functions deploy channel-connect channel-send baileys-inbound
```

## 4. Tenant flow

1. Tenant admin → Settings → Channels → **Connect WhatsApp**
2. Frontend calls `POST /functions/v1/channel-connect` → receives `qr` data URI
3. Render the QR image; tenant opens WhatsApp on their phone → Settings → Linked Devices → Scan
4. Baileys fires `connection` event → Supabase flips `channel_accounts.status = 'connected'`
5. Frontend polls `/functions/v1/channel-connect` (or listens to a Realtime channel on `channel_accounts`) to detect the flip → shows "Connected as +965xxx"
6. Done. Inbound messages now land in `messages` table.

## 5. What works right now without deploying Baileys

Until you deploy the Node service, `BAILEYS_SERVICE_URL` is unset and `channel-connect` returns a friendly "service not yet configured" response. All UI and schema work continues to apply.

## 6. Risks to manage

- **WhatsApp ToS**: Baileys explicitly states it's unaffiliated with WhatsApp; bulk/automated messaging can trigger bans. Keep AI replies conversational, don't broadcast blast messages to cold lists. Warn tenants in your Terms.
- **Session auth files are keys**: anyone with `auth/<session>/creds.json` has full access to that WhatsApp account. Persistent volume must have 600 permissions; backups should be encrypted.
- **Protocol drift**: when WhatsApp updates, expect a Baileys patch release — keep the service on a recent version (`npm update baileys` quarterly).
- **Rate limits** (undocumented by Meta): don't send > ~10 messages/sec per session. Baileys doesn't enforce this; if tenants abuse, WhatsApp bans the number.

## 7. Migration path to official Meta Cloud API

Any tenant that grows big enough to want official API / green tick:
1. Get them through Meta BSP onboarding
2. Update their `channel_accounts` row: `provider = 'meta_cloud'`, store Meta token in `metadata`
3. Write a `channel-send` branch that checks `provider` and calls the right backend
4. Schema is already ready — no migration needed

## What's next

**Phase 2**: the unified Inbox UI — a new `/` home route, conversation list + thread view, inline "Book from chat" action, co-branded with Spa & More's tokens. Pure frontend.
