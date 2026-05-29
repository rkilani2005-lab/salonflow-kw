
-- Phase 4B: Instagram channel additive columns
ALTER TABLE public.channel_accounts
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Lookup helper used by instagram-inbound webhook to find the
-- channel_accounts row for an incoming IG page id. SECURITY DEFINER
-- so the webhook (which is anonymous) can resolve the row without
-- exposing access_token to clients.
CREATE OR REPLACE FUNCTION public.find_channel_account_by_provider(
  p_provider text, p_provider_account_id text
) RETURNS TABLE (
  id uuid, tenant_id uuid, channel text, provider text,
  provider_account_id text, status text, ai_agent_enabled boolean,
  auto_reply_enabled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, tenant_id, channel, provider, provider_account_id, status,
         ai_agent_enabled, auto_reply_enabled
    FROM public.channel_accounts
   WHERE provider = p_provider
     AND provider_account_id = p_provider_account_id
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_channel_account_by_provider(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_channel_account_by_provider(text, text) TO service_role;
