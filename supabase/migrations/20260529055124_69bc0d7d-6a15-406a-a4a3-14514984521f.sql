
DROP FUNCTION IF EXISTS public.find_channel_account_by_provider(text, text);
ALTER TABLE public.channel_accounts
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS provider_metadata;
