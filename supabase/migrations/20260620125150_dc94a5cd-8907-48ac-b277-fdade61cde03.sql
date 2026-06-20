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

  IF v_is_generated = 'ALWAYS' THEN
    ALTER TABLE public.client_packages
      ADD COLUMN IF NOT EXISTS sessions_remaining_plain integer;

    UPDATE public.client_packages
      SET sessions_remaining_plain = sessions_remaining;

    ALTER TABLE public.client_packages DROP COLUMN sessions_remaining;
    ALTER TABLE public.client_packages
      RENAME COLUMN sessions_remaining_plain TO sessions_remaining;

    UPDATE public.client_packages
      SET sessions_remaining = GREATEST(0, COALESCE(sessions_total, 0) - COALESCE(sessions_used, 0))
      WHERE sessions_remaining IS NULL
        AND package_type = 'session';
  END IF;
END $$;