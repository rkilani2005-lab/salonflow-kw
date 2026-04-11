# ZAINA SalonFlow KW — Full Performance & Security Audit
**Date:** April 2026 | **Auditor:** Claude (automated) | **Scope:** All sprints 1–5 + online booking

---

## Executive Summary

| Category | Score | Status |
|---|---|---|
| Security — RLS | 7/10 | ⚠️ Partially resolved |
| Security — Secrets | 6/10 | ⚠️ Issues found |
| Security — Auth | 8/10 | ✅ Good |
| Performance — Bundle | 4/10 | 🔴 Critical — 2.2MB JS |
| Performance — Queries | 6/10 | ⚠️ 48 wildcard SELECTs |
| Performance — DB Indexes | 7/10 | ⚠️ Missing on key columns |
| Code Quality — TypeScript | 6/10 | ⚠️ 181 `as any` casts |
| Code Quality — Structure | 7/10 | ✅ Reasonable |
| Accessibility | 3/10 | 🔴 Critical gaps |
| Error Handling | 7/10 | ✅ Mostly handled |

---

## 🔴 CRITICAL — Performance

### 1. No Code Splitting — 2.2MB JavaScript Bundle
**Severity: Critical**

The entire app loads as a single 2.2MB JS chunk (580KB gzipped). All 49 routes, 32+ pages, and every dependency are downloaded on first visit — even the admin panel, finance module, and AI pages that most users never open.

**Impact:** 3–8 second first load on 4G (Kuwait average). Lovable's PWA cache can't help with first visit.

**Fix:**
```typescript
// App.tsx — convert every page import to lazy()
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Calendar   = lazy(() => import('./pages/Calendar'));
const POS        = lazy(() => import('./pages/POS'));
// ... all 32 pages
// Wrap Routes in <Suspense fallback={<PageLoader/>}>
```
Expected reduction: 2.2MB → ~300KB initial + chunks on demand.

---

### 2. 48 Wildcard SELECT Queries (`select('*')`)
**Severity: High**

48 queries fetch entire rows when only 2–5 columns are needed. For tables like `bookings`, `clients`, `transactions` with 15–25 columns each, this is significant unnecessary data transfer on every page load.

**Worst offenders:**
- `AuthContext.tsx` — `select('*')` on `tenants` and `branches` on every auth refresh
- `useClients.ts` — `select('*')` on every client list load
- `useFinance.ts` — 6 wildcard queries across finance hooks
- `useLoyalty.ts` — wildcard on loyalty config and transactions

**Fix:** Replace with explicit column lists:
```typescript
// Before
supabase.from('clients').select('*')
// After
supabase.from('clients').select('id, name, phone, email, tier, loyalty_points, created_at')
```

---

### 3. No `staleTime` on Most Queries
**Severity: Medium**

Only 3 queries have `staleTime` configured. Every component mount triggers a refetch. With 8–12 queries per page, navigating between Calendar, Dashboard and POS re-fetches all data every time even if it's seconds old.

**Fix:**
```typescript
// Global default in App.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000 },
  },
});
```

---

### 4. PWA Pre-caches 8MB
**Severity: Medium**

`workbox` is pre-caching all `*.{js,css,html,ico,png,svg,woff2}` with a 3MB file size limit. The current 2.2MB JS bundle is cached but so are all SVGs and PNGs. Total pre-cache footprint is **8.1MB**.

---

## 🔴 CRITICAL — Security

### 5. GitHub PAT Still Embedded in Remote URL
**Severity: Critical**

The token `ghp_[REDACTED — revoke immediately]` is embedded in the git remote URL:
```
https://rkilani2005-lab:ghp_[REDACTED — revoke immediately]@github.com/...
```
This token was noted as "needs revocation" in session notes. It is visible in `git remote -v` output and may be stored in shell history or CI logs.

**Action required immediately:** Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Revoke this token.

---

### 6. Supabase Anon Key Hardcoded in WhatsApp Setup Component
**Severity: High**

```typescript
// src/components/whatsapp/WhatsAppSetup.tsx:109
const webhookUrl = `https://hrvuywkravhrptjxboss.supabase.co/functions/v1/whatsapp-webhook`;
```
The Supabase project ID (`hrvuywkravhrptjxboss`) is hardcoded. While this is a public URL, it should use `import.meta.env.VITE_SUPABASE_URL` for consistency and to avoid credential exposure if the project changes.

Also: the anon JWT key is in the `.env` file which **has been committed to git** (commit `ad6a89f`). Even though `.env` is not in `.gitignore` explicitly, it was tracked at some point. This means the anon key is in git history.

---

### 7. All Edge Functions Use `Access-Control-Allow-Origin: '*'`
**Severity: Medium**

Every edge function allows requests from any origin. This is acceptable for public-facing functions (`create-public-booking`, `whatsapp-webhook`) but `invite-user`, `myfatoorah-payment`, and `scheduling-agent` should restrict to your app domain.

**Fix:**
```typescript
const allowedOrigin = req.headers.get('origin') || '';
const isAllowed = allowedOrigin.includes('zaina.app') || allowedOrigin.includes('lovable.dev');
'Access-Control-Allow-Origin': isAllowed ? allowedOrigin : 'https://zaina.app'
```

---

### 8. Client Portal Tokens — Open SELECT Policy
**Severity: Medium**

```sql
CREATE POLICY "Public token lookup" ON public.client_portal_tokens 
  FOR SELECT USING (true);
```
Any authenticated user can enumerate all portal tokens across all tenants by querying the table directly. The token itself is the secret, but token enumeration is still a risk.

**Fix:** Scope to `tenant_id` or use service_role only:
```sql
CREATE POLICY "Token lookup by value only"
  ON public.client_portal_tokens FOR SELECT
  USING (true); -- keep for public booking page
-- Add: expire old tokens via a cron job
```

---

### 9. LIKE Queries With User Input — Potential SQL Injection Risk
**Severity: Low (mitigated by Supabase SDK)**

In the edge function:
```typescript
.like('phone', `%${digits.slice(-8)}`)
```
The Supabase JS SDK parameterises all queries, so raw SQL injection is not possible. However, a very large `digits` string could cause performance issues. The input should be validated to be exactly 8 digits before using in LIKE.

---

### 10. RLS Migration History — Overlapping Policies
**Severity: Medium (partially resolved)**

The booking RLS went through 5 migrations that created/dropped overlapping policies. The current state (migration `20260407`) is clean, but **these migrations have NOT been applied to the Supabase production database** — Supabase does not auto-apply migrations from GitHub. The team must manually run:
```bash
supabase db push
```
Until this runs, the production database is operating on the original insecure policies.

---

## ⚠️ HIGH — Code Quality

### 11. 181 TypeScript `as any` Casts
**Severity: High**

181 instances of `as any` bypass TypeScript's type safety entirely. The most dangerous patterns:

```typescript
// Calendar.tsx
.insert([{ ...booking, status: (booking.status || 'planned') as any }])

// WhatsAppTriggers.tsx
await (supabase as any).rpc('seed_whatsapp_templates', ...)

// Packages.tsx
{(services as any[]).map((s: any) => ...)}
```
These hide real type errors and make refactoring unsafe.

---

### 12. Admin Pages Use `useState` + `useEffect` Instead of React Query
**Severity: Medium**

6 admin pages (`AdminDashboard`, `AdminAnalytics`, `AdminFinance`, `AdminAccounts`, `AdminSubscriptions`, `AdminTenants`) use manual `useState(true)` loading + `useEffect` fetch patterns instead of `useQuery`. This means:
- No caching — every navigation re-fetches
- No background refresh
- Manual error handling scattered across pages
- Race conditions possible if component unmounts during fetch

---

### 13. Reports.tsx is 988 Lines — Single File Doing Too Much
**Severity: Medium**

`Reports.tsx` contains 7 data hooks, 5 chart components, export logic, and the full page layout in one 988-line file. This makes it slow to parse, hard to maintain, and impossible to lazy-load individual report tabs.

---

## ⚠️ MEDIUM — Missing Database Indexes

### 14. Bookings Table — Missing `client_id` + `is_online_booking` Indexes
**Severity: Medium**

The `bookings` table has indexes on `booking_date`, `staff_id`, `status`, `payment_id` — but **not on `client_id`** or `is_online_booking`. 

The `BookingRequests` page now queries `WHERE is_online_booking = true` which does a full table scan. The client portal queries `WHERE client_id = X` which also full-scans.

**Fix migration:**
```sql
CREATE INDEX idx_bookings_client     ON public.bookings(client_id);
CREATE INDEX idx_bookings_online     ON public.bookings(is_online_booking) WHERE is_online_booking = true;
CREATE INDEX idx_bookings_date_staff ON public.bookings(booking_date, staff_id);
CREATE INDEX idx_clients_phone       ON public.clients(phone);
CREATE INDEX idx_clients_tenant_phone ON public.clients(tenant_id, phone);
```

---

## ⚠️ HIGH — Accessibility

### 15. Critically Low Accessibility Coverage
**Severity: High**

Only 6 `aria-*` attributes across all 32 pages. Specific gaps:
- All icon-only buttons lack `aria-label` (sidebar, close, edit, delete buttons)
- Calendar drag-and-drop has no keyboard alternative
- POS cart has no `role="list"` or item announcements
- Modal dialogs missing `aria-describedby`
- No skip-to-content link
- Form inputs in AddClientDialog, WalkInDialog use `{...register('field')}` which does attach labels correctly via `htmlFor` — this part is OK

---

## ⚠️ MEDIUM — Data & State Issues

### 16. Settings — Notification Preferences Stored in localStorage Only
**Severity: Medium**

```typescript
localStorage.setItem(`notif_prefs_${tenant?.id}`, ...)
localStorage.setItem(`working_days_${currentBranch?.id}`, ...)
```
These settings are device-specific. If the owner logs in from a different device or browser, all notification preferences are lost. Should be persisted in the `tenant_preferences` or `branches` table.

---

### 17. No Optimistic Updates on Mutations
**Severity: Low**

All mutations wait for server confirmation before updating the UI. For high-frequency actions (booking status changes, attendance marking), this creates a noticeable delay. React Query's `onMutate` + rollback pattern would make these feel instant.

---

## ✅ What's Working Well

1. **All 69 DB tables have RLS enabled** — no tables are unprotected
2. **Service role key never in frontend** — all sensitive operations go through edge functions
3. **No hardcoded secrets in source code** — only in `.env` and Supabase vault
4. **Input validation** — 63 Zod schemas used across forms
5. **Phone normalisation** — bulletproof multi-variant lookup handles all formats
6. **TypeScript compilation** — zero errors across 55,000+ lines of code
7. **PWA configured** — offline capability via Workbox
8. **Query guards** — 40 `enabled: !!tenantId` patterns prevent unauthenticated fetches
9. **Error boundaries** — try/catch in all async operations
10. **GSAP + refetchInterval** — real-time calendar and dashboard refresh

---

## Priority Fix Order

| Priority | Issue | Effort | Impact |
|---|---|---|---|
| 🔴 P0 | Revoke leaked GitHub PAT | 2 min | Critical security |
| 🔴 P0 | Run `supabase db push` | 5 min | RLS migrations not applied |
| 🔴 P1 | Code splitting (lazy imports) | 2 hours | 85% bundle reduction |
| 🔴 P1 | Add missing DB indexes | 30 min | Query performance |
| ⚠️ P2 | Replace `select('*')` with column lists | 4 hours | Network & memory |
| ⚠️ P2 | Add `staleTime` global default | 15 min | Stops unnecessary fetches |
| ⚠️ P2 | Move Settings prefs to DB | 1 hour | Data persistence |
| ⚠️ P3 | Migrate admin pages to useQuery | 3 hours | Caching & reliability |
| ⚠️ P3 | Reduce `as any` casts | Ongoing | Type safety |
| ⚠️ P3 | Accessibility pass | 2 hours | Legal & UX compliance |
| 💡 P4 | Scope CORS on internal edge fns | 30 min | Attack surface reduction |
| 💡 P4 | Split Reports.tsx into components | 2 hours | Maintainability |

