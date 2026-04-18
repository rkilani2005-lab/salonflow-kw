# Zaina / SalonFlow — Audit & Polish Plan

Living document. Updated as work progresses.

---

## Phase A — UI/UX Consolidation  *(in progress)*

Small, reviewable commits. Zero business-logic changes.

| # | Task | Status |
|---|---|---|
| A.1 | Shared UI state primitives: `<EmptyState/>`, `<LoadingSkeleton/>`, `<ErrorState/>` | 🟡 started |
| A.2 | Wire primitives into all 30 pages (currently 11/30 have explicit empty states) | ⬜ |
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
| B.1 | **Appointment → Checkout → Invoice state machine** — decouple `booking.status === 'completed'` from payment state. **Known bug: marking appointment complete from Calendar dropdown skips payment entirely, then UI shows "Invoice fully paid".** | 🔴 confirmed bug |
| B.2 | Refund paths — full/partial, inventory reversal, GL posting symmetry | ⬜ |
| B.3 | Discount approval workflow | ⬜ |
| B.4 | Day session open/close + Z-report variance accuracy | ⬜ |
| B.5 | Split payments — cash + card + gift card in one checkout | ⬜ |
| B.6 | Loyalty accrual & redemption math | ⬜ |
| B.7 | Package session consumption | ⬜ |
| B.8 | Inventory deduction on service completion (BOM / recipe) | ⬜ |
| B.9 | PO → GRN → stock movement → GL posting chain | ⬜ |
| B.10 | GL double-entry integrity per posting module | ⬜ |
| B.11 | Staff commission calculation | ⬜ |
| B.12 | Multi-tenant data isolation (RLS) | ⬜ |
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
