-- ============================================================
-- Settings persistence — move localStorage prefs to DB
-- Audit P2: notification_prefs + working_days per device is lost
-- on different devices/browsers
-- ============================================================

-- ── 1. Add notification_prefs JSONB to tenants ───────────────
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{
    "emailNotif": true,
    "smsNotif": true,
    "bookingReminders": true,
    "marketingEmails": false
  }'::jsonb;

-- ── 2. Add working_days JSONB to branches ────────────────────
-- Stored as { sun: true, mon: true, tue: true, wed: true, thu: true, fri: false, sat: false }
-- Matches the Record<string, boolean> used in Settings.tsx
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '{
    "sun": true, "mon": true, "tue": true,
    "wed": true, "thu": true, "fri": false, "sat": false
  }'::jsonb;

-- ── 3. Ensure update policies cover the new columns ──────────
-- tenants update: owners can update their own tenant (existing policy covers it)
-- branches update: owners/managers can update their branch (existing policy covers it)
-- No new policies needed — columns inherit table-level RLS.

-- ── 4. Index on tenants(id) for settings fetch (usually PK, but confirm)
-- Already has PK index, no action needed.
