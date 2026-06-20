-- ============================================================================
-- Packages v2 fix — make client_packages.sessions_remaining a plain column.
--
-- The original table (sprint5) defined:
--   sessions_remaining INTEGER GENERATED ALWAYS AS (sessions_total - sessions_used) STORED
-- but the v2 activate/redeem logic (20260616000001) INSERTs and UPDATEs
-- sessions_remaining directly — required for memberships (cycle refills),
-- wallets, and unlimited packages where "remaining" is not simply
-- total - used. Writing to a GENERATED ALWAYS column raises:
--   "cannot insert a non-DEFAULT value into column sessions_remaining"
--
-- This converts the column to a normal nullable integer, preserving existing
-- values. Idempotent: only acts if the column is still generated.
-- ============================================================================

DO $$
DECLARE
  v_is_generated text;
BEGIN
  SELECT is_generated
    INTO v_is_generated
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'client_packages'
    AND column_name  = 'sessions_remaining';

  -- Only convert if it is currently a generated column.
  IF v_is_generated = 'ALWAYS' THEN
    -- 1) Add a plain holding column.
    ALTER TABLE public.client_packages
      ADD COLUMN IF NOT EXISTS sessions_remaining_plain integer;

    -- 2) Copy current computed values across.
    UPDATE public.client_packages
      SET sessions_remaining_plain = sessions_remaining;

    -- 3) Drop the generated column and rename the plain one into its place.
    ALTER TABLE public.client_packages DROP COLUMN sessions_remaining;
    ALTER TABLE public.client_packages
      RENAME COLUMN sessions_remaining_plain TO sessions_remaining;

    -- 4) Backfill a sane default for session-type rows where it ended up null.
    UPDATE public.client_packages
      SET sessions_remaining = GREATEST(0, COALESCE(sessions_total, 0) - COALESCE(sessions_used, 0))
      WHERE sessions_remaining IS NULL
        AND package_type = 'session';
  END IF;
END $$;
