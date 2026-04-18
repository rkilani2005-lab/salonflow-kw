# Zaina APK — Smoke Test Plan

Use this document the first time you install the debug APK from
GitHub Actions.  It covers everything we touched this session:
Phase A polish, Phase B integrity fixes, Phase C native wrap.

Total time if everything works: ~25 minutes for a single tester.

---

## 0. Prerequisites

Before sideloading the APK:

- [ ] Android device on API 22+ (Android 5.1+).  Physical phone preferred —
      emulator works for UI but camera / biometric tests need real hardware.
- [ ] Tenant account already provisioned in Supabase with at least one
      owner user, some services, some products, some clients.  This
      smoke test exercises existing data, doesn't create a tenant from
      scratch.
- [ ] At least one test booking in the next 7 days for a client with
      a real phone number (you'll use this for the WhatsApp + refund
      tests).
- [ ] Another test device or browser tab logged into the same tenant
      for concurrency tests (B.4 refund-race, B.5 gift-card race).

## 1. Get the APK

1. Open https://github.com/rkilani2005-lab/salonflow-kw/actions
2. Pick the most recent `Android APK build` run on `main`.
3. Scroll to `Artifacts` at the bottom → download `zaina-debug-apk`.
4. Unzip; you'll get `zaina-debug.apk`.
5. Transfer to phone (USB / email / cloud drive).
6. Tap to install.  Allow "Install from unknown sources" if asked.

## 2. Launch & identity

- [ ] App icon shows in the launcher under the name **Zaina**
- [ ] Tapping the icon shows the splash screen (dark background,
      no spinner, ~1.5s)
- [ ] Splash dismisses to the Sign In page
- [ ] Status bar renders correctly (no overlap with the header)
- [ ] First sign-in with email + password works → Dashboard loads

## 3. Biometric login (Phase C)

After you've signed in once:

- [ ] Sign out (sidebar → bottom → Sign out)
- [ ] Back on the Sign In page, a second button appears below "Sign In":
      either "Unlock with fingerprint", "Unlock with Face ID", or
      generic "Unlock with biometric" depending on device enrolment
- [ ] Tap it → OS biometric prompt → authenticate → app signs in
      without typing password
- [ ] Fail biometric 2× in a row → "Stored credentials no longer work"
      message (or similar), password field still available

## 4. Language persistence (Phase A — this session fix)

- [ ] In the app, switch to Arabic (settings or sidebar language toggle)
- [ ] Entire UI flips to RTL, Arabic labels throughout
- [ ] Close the app completely (swipe away from recents) and reopen
- [ ] **App opens in Arabic, not English** — this was broken before
      and is the fix shipped in commit 2a2e7f0
- [ ] Switch back to English and confirm it persists too

## 5. Dashboard

- [ ] Today's appointments list loads (or shows primitive empty state
      with "+ Add appointment" button if no appointments today)
- [ ] KPI cards populate (revenue, bookings, new clients)
- [ ] Tapping any KPI navigates to the relevant detail view

## 6. Calendar + WhatsApp triggers (B.14)

### Prerequisite: enable the trigger

1. Go to Settings → WhatsApp Automation (or sidebar if present)
2. If triggers list is empty, tap "Generate default automations"
3. Toggle **Booking Confirmed** on

- [ ] The toggle actually saves — refresh the page, switch still on.
      This was broken before commit a35b2f7 (wrong column name).

### Fire the trigger

1. Calendar → tap an empty slot → create a booking for a test
   client with a real WhatsApp phone number
2. Save as 'confirmed'

- [ ] No error toast (quiet success is the right behaviour)
- [ ] If Firebase / Meta WhatsApp are actually configured server-side,
      you receive a WhatsApp message.  If not, check
      `whatsapp_sent_log` in Supabase — an attempted send row should
      appear.  This proves B.14's dispatcher is wired.

## 7. POS — the centrepiece

This section covers B.1, B.5, B.6, B.8, B.10, B.11 in one flow.

### 7a. Walk-in with discount, tip, loyalty

1. POS → walk-in mode → select a known client with some loyalty
   points (if loyalty is configured)
2. Add 2 services
3. Apply a manager-level discount (≥ threshold configured in
   settings — triggers the discount-approval dialog)

- [ ] Discount-approval dialog appears (B.3)
- [ ] Entering wrong PIN 5× throttles for 30s (B.3)
- [ ] Entering the manager's PIN approves

4. Redeem some loyalty points

- [ ] Loyalty redeem block appears when client is selected (B.6 —
      was entirely invisible before this session)
- [ ] Typing points shows the KWD discount value
- [ ] The cap warning displays if you try to redeem more than
      50% of the subtotal

5. Add a tip of 3 KWD

6. Tap "Proceed to Payment"

### 7b. Split payment

- [ ] Payment sheet opens with the grand total
- [ ] Enter partial cash (e.g. 10 KWD)
- [ ] Add another method (knet) for the remainder
- [ ] Change display — if cash > what's owed, shows change due (B.5)
- [ ] Cannot over-redeem a gift card (B.5 — if you have one loaded,
      try to put more in it than its balance; blocked)

7. Complete sale

- [ ] Success toast
- [ ] Receipt view opens
- [ ] Loyalty balance on the client has changed (earn + redeem both
      recorded — check Clients page)
- [ ] In Supabase (if you have access), the transaction has a
      balanced journal entry — debits = credits (B.10 — was broken
      before this session for every single sale)

## 8. POS refund (B.2)

From the receipt view of the sale you just completed:

- [ ] "Refund" button visible (owner / manager / cashier / inventory_clerk
      roles only — B.13).  Log in as a stylist to verify it's HIDDEN.
- [ ] Tap refund → full refund dialog
- [ ] Reason required
- [ ] Complete refund

- [ ] Transaction status flips to 'refunded' in the list
- [ ] Inventory products used in the sale are restored to stock
      (check Inventory → Stock Movements — refund entries appear)
- [ ] Loyalty earn row is reversed (client balance reflects)
- [ ] Loyalty redemption is refunded back (client gets points back)
- [ ] Package session (if the sale used one) is returned — check
      Packages page
- [ ] Staff commission for that sale is voided (check Staff → Commissions
      if that view exists, or query Supabase directly)
- [ ] GL journal entry reversal is posted (B.10 balance check applies here too)
- [ ] **Try to refund again** → "already refunded" rejection (B.2)

## 9. Day session / Z-report (B.4)

- [ ] Day Session page shows live totals (not just at close-out)
- [ ] Expected cash = opening float + cash sales − cash refunds
      (**refunds subtract properly** — this was broken before B.4)
- [ ] Record a cash refund, then check: expected cash drops by the
      refund amount in real time

## 10. Inventory — BOM + procurement

### 10a. Service consumption (B.8)

From POS, sell a service that has a recipe (BOM) configured for
one of the products.

- [ ] Stock of the recipe product decrements after sale
- [ ] If stock is insufficient, cashier sees a warning toast
      ("Stock went negative" or "BOM stock update failed")
- [ ] Inventory → Stock Movements shows the consumption entry

### 10b. Goods receipt (B.9)

Receive a PO:

- [ ] WAC (weighted average cost) updates correctly
- [ ] Over-receive warns ("Over-receive: line exceeds PO by N")
- [ ] Stock increments

### 10c. Vendor payment (B.9, B.13)

Pay a vendor invoice:

- [ ] Log in as accountant / manager / owner role → payment dialog opens
- [ ] Log in as receptionist → "Not permitted" blocks (B.13)
- [ ] Try to pay more than the invoice total → blocked with clear
      error (B.9)
- [ ] Fire two concurrent payments from two devices on the same
      invoice → second one sees the updated balance and rejects if
      it would overpay (B.9 race fix)

## 11. Team users + plan limits (B.15)

- [ ] Team Users page shows current seats as `X / Y`
- [ ] Including any pending invites in the count (was broken before B.15)
- [ ] On a starter-plan tenant with 2 members: fire 3 invites in
      rapid succession.  Only one should succeed; other two bounce
      with "You currently have X members plus N pending invites"

## 12. Native camera (Phase C)

From Inventory → Add Product, if a "Take photo" option is available:

- [ ] Tapping it opens the system camera / photo picker prompt
- [ ] Shot photo previews before save
- [ ] Saved photo attaches to the product record

Same for Expenses → Add → Attach receipt.

If no explicit camera buttons are wired yet, that's expected —
the native bridge exists (`src/lib/native/camera.ts`) but wiring
into specific upload paths was deferred.  Flag in your test report.

## 13. Known gaps — things that WILL NOT work yet

These are documented; report them as new issues ONLY if the
behaviour differs from what's listed here.

- **Push notifications** won't arrive — no Firebase project / no
  `google-services.json` yet.  Device registers a push token on
  sign-in (the `device_push_tokens` row is created if the migration
  `20260418000002_c1_device_push_tokens.sql` has been applied),
  but nothing server-side is sending to those tokens.
- **WhatsApp delayed triggers** (`reminder_24h`, `reminder_1h`,
  `reengagement`) are logged but not dispatched — they need a
  scheduler (pg_cron or Supabase scheduled functions).  Immediate
  triggers (`booking_confirmed`, `booking_cancelled`, `receipt_sent`)
  do fire.
- **POS package redemption** — if a client has paid-up sessions on
  a package, the POS does NOT yet offer to consume a session at
  checkout.  The Redeem button on the Packages page works; in-POS
  integration is a flagged feature commit.
- **Procurement GL posting** — GRN, AP invoice creation, vendor
  payment don't post journal entries.  POS sales and refunds DO.
  Flagged.
- **iOS build** — Android only; iOS awaits Apple Developer account.
- **Full RTL correctness** — the CSS override in commit 2a2e7f0
  covers the 80% most-common cases.  You may still see specific
  pages where padding / border sides look wrong in Arabic.  The
  proper fix is a Tailwind logical-utility migration — deferred.

## 14. What to report back

For anything that fails this checklist, capture:

1. Screen recording or screenshot
2. The Supabase transaction / booking / client ID involved (from
   the URL or a detail view)
3. The exact steps to reproduce
4. Which item number in this doc failed

Paste into a new session with the repo state and I can fix fast.

## 15. Success criteria

This is a **shippable-to-testers** APK if at minimum:

- Sections 2, 3, 4, 5 pass (launch, biometric, language, dashboard)
- POS core flow (section 7) completes without errors
- Refund flow (section 8) reverses inventory and loyalty
- Plan-limit race (section 11) rejects overages

Sections 6 (WhatsApp), 12 (camera), 13 (known gaps) are
nice-to-haves for this build — they depend on server-side config
we haven't set up yet.
