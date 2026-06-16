# Packages v2 — All Five Types (Handoff)

## What shipped
The Packages page (`/packages`) now supports **five package types**, up from one:

| Type | What it is | Redemption | Depletes? |
|------|-----------|------------|-----------|
| `session` | N sessions of one service at a discount | per-session counter | yes, at 0 |
| `bundle` | a fixed set of *different* services, one price | per-service line | when all lines used |
| `wallet` | prepaid KWD credit, optional bonus | debit an amount | when credit = 0 |
| `membership` | recurring allowance, renews each cycle | per-session counter | no — refills each cycle |
| `unlimited` | unlimited use until expiry | eligibility check, no decrement | only on expiry |

## The original bug
The "New Package" button appeared dead. Cause: `<SelectItem value="">` in the create
dialog. Radix Select v2.2.5 throws on empty-string item values, which crashed the dialog
on render so the click did nothing. Fixed by using a `NO_SERVICE = '__none__'` sentinel.
Backend (table, RLS, route) was fine all along.

## Database changes — 3 migrations (apply in order)
1. `20260616000001_packages_all_types.sql`
   - enum `package_type`; new columns on `service_packages` + `client_packages`
   - new tables `package_items`, `client_package_items`, `membership_renewals`
   - RPCs `sell_package`, `redeem_package`, `run_membership_renewals`
   - pg_cron job `membership_renewals_daily` @ 23:00 UTC (02:00 Asia/Kuwait)
2. `20260616000002_packages_deferred_revenue_gl.sql`
   - `post_package_sale_to_gl`, `post_package_redemption_to_gl`, `_pkg_liability_account`
3. `20260616000003_redeem_for_item_all_types.sql`
   - upgrades the POS entry point `redeem_package_for_item` to be type-aware

After applying, regenerate `src/integrations/supabase/types.ts` so the new columns are typed.

## Accounting (deferred revenue — keeps P&L honest)
- **Sale**: Dr cash/card · Cr **2220** Deferred Revenue (packages) — or **2200** Gift Card
  Liability for wallets. A sold package is a *liability*, not revenue.
- **Redemption**: Dr liability · Cr **4xxx** service revenue. Revenue is recognised only as
  the client consumes the package, at the service's standalone price.
- Both postings are fire-and-forget from the hooks; a GL failure never blocks the sale.

## Auto-billing for memberships — what it does and does NOT do
- `run_membership_renewals()` runs daily. For each active membership whose `renews_at` has
  passed it: resets the session allowance, advances `renews_at` by the billing interval, and
  raises a **`due`** row in `membership_renewals`. Idempotent per (client_package, cycle_date).
- It does **not** charge a card. No payment processor is wired (same gap as email). Collection
  happens at the desk — the page shows a "renewals due" banner and KPI. When a processor is
  added later, swap the body that marks a renewal `collected` for a charge call; nothing else
  needs to change.

## Validation performed
Spun up a local Postgres 16, replayed all 3 migrations clean, then exercised:
- sell + redeem for all 5 types — counters/credit/bundle-lines all correct
- every journal entry nets to zero (sale and redemption, session and wallet)
- membership renewal cron: entitlement reset, date advanced, due row raised, idempotent
- POS `redeem_package_for_item`: bundle line consumed, idempotent on repeat
`npx tsc --noEmit` → 0 errors.

## Known follow-ups
- POS cart UI (`POSCart.tsx`) currently surfaces session-style packages by `service_id`.
  Bundle/unlimited lines redeem correctly through `redeem_package_for_item` at checkout, but
  the cart's "redeem from package" picker could be extended to show bundle/unlimited eligibility
  more explicitly. Not required for correctness — the checkout RPC handles all types.
- Wallet as a *tender* at POS (paying a whole sale from wallet credit) is a separate path from
  per-line redemption; today wallet is debited from the Packages page. Wiring wallet as a POS
  payment method is the natural next step.
