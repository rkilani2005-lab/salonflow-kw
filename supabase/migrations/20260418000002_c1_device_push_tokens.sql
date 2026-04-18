-- ============================================================
-- Phase C.1  Device push token storage
--
-- Native app registration flow:
--   1. App starts, user signs in
--   2. Capacitor Push Notifications requests OS permission
--   3. FCM (Android) / APNs (iOS) returns a device token
--   4. src/lib/native/push.ts upserts that token to this table
--   5. Backend (future edge function / scheduler) reads from here
--      to target specific devices for booking alerts, low-stock
--      warnings, commission payout notifications, etc.
--
-- (user_id, device_token) is the natural key: a user may log in
-- on multiple devices, and each device may have its own token.
-- Tokens rotate — on rotation, the client upserts the new one;
-- stale rows are cleaned up by a scheduled purge of rows with
-- updated_at older than 60 days.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token  TEXT NOT NULL,
  platform      TEXT NOT NULL,            -- 'android' | 'ios' | 'web'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user
  ON public.device_push_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_updated
  ON public.device_push_tokens(updated_at);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read and write only their own tokens.  No cross-user
-- visibility — a device token is a credential-grade identifier
-- that could be used to send spoofed pushes if leaked.
CREATE POLICY "Users manage their own push tokens"
  ON public.device_push_tokens FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role (edge functions sending pushes) bypasses RLS by default,
-- so no service-role policy is needed.
