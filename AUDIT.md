# Zaina / SalonFlow — Audit & Polish Plan

Living document. Updated as work progresses.

---

## Phase A — UI/UX Consolidation  *(in progress)*

Small, reviewable commits. Zero business-logic changes.

| # | Task | Status |
|---|---|---|
| A.1 | Shared UI state primitives: `<EmptyState/>`, `<LoadingSkeleton/>`, `<ErrorState/>` | ✅ done (`e96c707`) |
| A.2 | Wire primitives into all 30 pages (currently 11/30 have explicit empty states) | 🟡 6 inventory tabs done (`c01092c`); ~12 pages remaining |
| A.3 | Replace scattered chart color hex values with centralized `chart-colors.ts` | ⬜ |
| A.4 | RTL parity sweep — convert directional utilities (ml/mr/pl/pr) to logical (ms/me/ps/pe) where RTL shows bugs | ⬜ |
| A.5 | Typography scale audit — Bricolage / Plus Jakarta / IBM Plex Arabic consistency | ⬜ |
| A.6 | Mobile breakpoint pass — every page usable at 375px width | ⬜ |
| A.7 | Touch target audit — every interactive element ≥ 44×44px | ⬜ |
| A.8 | Visual unification across POS ↔ Calendar ↔ Reports (drift cleanup) | ⬜ |

---

## Phase B — Process Integrity Matrix  *(queued)*

End-to-end scenarios. Each produces either a ✅ or a bug fix.

| # | Scenario | Status |
|---|---|---|
| B.1 | **Appointment → Checkout → Invoice state machine** — decouple `booking.status === 'completed'` from payment state. **Known bug: marking appointment complete from Calendar dropdown skips payment entirely, then UI shows "Invoice fully paid".** | ✅ fixed (`1847140`) |
| B.2 | Refund paths — full/partial, inventory reversal, GL posting symmetry | ✅ fixed (this commit) — GL reversal entry, service BOM reversal, double-refund guard, booking status preserved, booking_id retained on reversal row, Z-report double-count fixed |
| B.3 | Discount approval workflow | ✅ fixed (this commit) — isolated verify client prevents session hijack, self-approval blocked, brute-force throttled, best-effort audit log |
| B.4 | Day session open/close + Z-report variance accuracy | ✅ fixed (this commit) — cash refunds now subtracted from expected cash, refund payment method persisted to transaction_payments, live day totals hook replaces stale snapshot fields |
| B.5 | Split payments — cash + card + gift card in one checkout | ✅ fixed (this commit) — gift card overdraft blocked, multi-gift-card sums correctly, cash change display, currency not hardcoded, consistent 0.001 tolerance |
| B.6 | Loyalty accrual & redemption math | ✅ fixed (this commit) — field names repaired (entire loyalty was a no-op), concurrency guard on redemption, discount-ordering cap, refund reverses points |
| B.7 | Package session consumption | 🟡 partial — server-side expiry/depletion guards added, refund now reverses package sessions. **GAP**: POS has no "use package session" option at checkout (useRedeemPackageSession is only called from Packages page button). Requires a dedicated feature commit. |
| B.8 | Inventory deduction on service completion (BOM / recipe) | ✅ fixed (this commit) — optimistic-concurrency stock decrement with 4-retry loop, negative-stock + failure surfaced as cashier-visible warnings, audit-log errors no longer swallowed |
| B.9 | PO → GRN → stock movement → GL posting chain | 🟡 partial — GRN stock/WAC race fixed, over-receive warned, vendor payment race fixed, over-payment blocked. **GAP**: no GL posting on GRN / AP creation / vendor payment (POS posts correctly; procurement is invisible to the ledger). Requires supplier GL mappings + dedicated posting logic. |
| B.10 | GL double-entry integrity per posting module | ✅ fixed (this commit) — balance verified in-memory before insert, discount/tax/tip lines added, header posted only after lines succeed, entry-number retry loop, refund JE balance-verified too |
| B.11 | Staff commission calculation | ✅ fixed (this commit) — rule lookup used nonexistent column names (feature silent since launch), migrated to get_commission_rate RPC, transaction_item_id populated, refund now voids/reduces earnings |
| B.12 | Multi-tenant data isolation (RLS) | ✅ fixed (this commit) — 3 tables had RLS enabled but no policy → default-deny → feature dead (budgets, campaigns, fiscal_periods). Migration 20260418000001 adds tenant-scoped CRUD policies. Audit notes: user_roles INSERT privilege escalation already patched in 20260330000001. USING(true) policies on booking_config / client_portal_tokens / whatsapp_conversations are intentional public-access paths (magic-link tokens, webhook service role). |
| B.13 | Role / permission enforcement | ⬜ |
| B.14 | WhatsApp trigger firing & payload correctness | ⬜ |
| B.15 | Plan / subscription limit enforcement | ⬜ |

---

## Phase C — Native App Wrap  *(after A + B green)*

Capacitor-based. iOS `.ipa` + Android `.apk/.aab`. Shares the same React codebase.

| # | Task | Status |
|---|---|---|
| C.1 | Add Capacitor + iOS + Android platforms | ⬜ |
| C.2 | App identity (icon, splash, name, bundle ID) | ⬜ |
| C.3 | Native plugins: push, biometrics, camera, share sheet, deep links | ⬜ |
| C.4 | Offline-tolerant POS | ⬜ |
| C.5 | Cloud CI: GitHub Actions macOS runner for iOS builds | ⬜ |
| C.6 | Store listings — App Store & Google Play | ⬜ |

---

## Baseline (at kickoff)

- Files: 213
- Pages: 30
- Pages with loading states: 29/30
- Pages with empty states: 11/30
- Hardcoded hex colors in code: ~50 (mostly Recharts palettes — acceptable, will centralize)
- RTL-aware files: 71
- Inline `style={{}}` usage: 0 (good)
