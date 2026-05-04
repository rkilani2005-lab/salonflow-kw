import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * D.8 — Channel accounts hook.
 *
 * Returns a tenant's connected channels and exposes the lifecycle
 * actions the Channels settings page (and the global disconnection
 * banner) need:
 *
 *   - status         : 'disconnected' | 'pending' | 'connected' | 'error' | 'expired'
 *   - qrCode         : data-URL string while pairing is in flight
 *   - connect()      : start a new pairing — invokes channel-connect
 *                      edge function, polls for QR, then for connected
 *   - disconnect()   : cleanly tears down the Baileys session
 *   - refresh()      : manual refetch (the hook also auto-refreshes
 *                      every 60s while a session is in non-terminal
 *                      state, every 3s while QR is pending)
 *
 * NOT building this on Supabase realtime because:
 *   - channel_accounts updates are infrequent (handful per tenant
 *     per day) — polling is fine and avoids the realtime channel
 *     limit per tenant
 *   - the bridge writes status changes; the realtime trigger setup
 *     wasn't shipped in the inbox migration so we'd need a follow-up
 *
 * If status reverts to 'disconnected' or 'error' unexpectedly, the
 * banner component picks it up and prompts the user to re-pair.
 */

export type ChannelStatus = 'disconnected' | 'pending' | 'connected' | 'error' | 'expired';

export interface ChannelAccount {
  id:                    string;
  tenant_id:             string;
  channel:               'whatsapp' | 'instagram' | 'telegram' | 'linkedin';
  provider:              string;
  status:                ChannelStatus;
  display_handle:        string | null;
  display_name:          string | null;
  profile_pic_url:       string | null;
  connected_at:          string | null;
  last_sync_at:          string | null;
  last_error:            string | null;
  ai_agent_enabled:      boolean;
  auto_reply_enabled:    boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export function useChannelAccounts(channel: 'whatsapp' = 'whatsapp') {
  const { tenant } = useAuth();
  const [account,    setAccount]    = useState<ChannelAccount | null>(null);
  const [qrCode,     setQrCode]     = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const pollTimer    = useRef<number | null>(null);

  const fetch = useCallback(async () => {
    if (!tenant?.id) return;
    const { data, error: e } = await supabase
      .from('channel_accounts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('channel', channel)
      .maybeSingle();
    if (e) {
      setError(e.message);
      setAccount(null);
    } else {
      setAccount((data as any) ?? null);
      // QR is transient — only show while pairing is in flight.
      if ((data as any)?.status !== 'pending') setQrCode(null);
    }
    setLoading(false);
  }, [tenant?.id, channel]);

  // Initial load + adaptive polling.
  useEffect(() => {
    fetch();
    const tick = () => {
      // Faster polling while a QR is on screen (every 3s) so the
      // 'connected' moment shows up promptly.  Slower (60s) when
      // the channel is in steady state — change detection only
      // matters for catching disconnections, not micro-latency.
      const interval = account?.status === 'pending' ? 3000 : 60000;
      pollTimer.current = window.setTimeout(async () => {
        await fetch();
        tick();
      }, interval);
    };
    tick();
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
    // Intentionally omitting `account` — the polling loop reads the
    // current state via fetch(); including it would re-arm the timer
    // on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, channel, fetch]);

  /**
   * Begin pairing.  Calls channel-connect which talks to the bridge
   * to spawn a session and returns a QR data URL.  We then poll
   * channel_accounts every 3s waiting for status to flip to
   * 'connected' (the bridge's webhook updates the row when the
   * scan succeeds).
   */
  const connect = useCallback(async () => {
    if (!tenant?.id) return;
    setActionLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('channel-connect', {
        method: 'POST',
        body: { tenant_id: tenant.id, channel: 'whatsapp' },
      });
      if (fnErr) throw new Error((data as any)?.error ?? fnErr.message ?? 'connect failed');
      if ((data as any)?.qr) setQrCode((data as any).qr);
      await fetch();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setActionLoading(false);
    }
  }, [tenant?.id, fetch]);

  /**
   * Tear down the pairing.  Calls the bridge's session DELETE which
   * runs Baileys logout and wipes auth files.  channel_accounts row
   * status flips to 'disconnected'.
   */
  const disconnect = useCallback(async () => {
    if (!account?.id) return;
    setActionLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('channel-connect', {
        method: 'DELETE',
        body: { tenant_id: account.tenant_id, channel: account.channel },
      });
      if (fnErr) throw new Error((data as any)?.error ?? fnErr.message ?? 'disconnect failed');
      setQrCode(null);
      await fetch();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setActionLoading(false);
    }
  }, [account, fetch]);

  return {
    account,
    qrCode,
    loading,
    actionLoading,
    error,
    connect,
    disconnect,
    refresh: fetch,
  };
}

/**
 * Lightweight read-only hook for the global banner.  Skips QR state
 * and exposes only what the banner needs.  Same polling cadence as
 * useChannelAccounts to share refresh load.
 */
export function useWhatsAppStatus() {
  const { account, loading } = useChannelAccounts('whatsapp');
  const isUnhealthy =
    !!account &&
    (account.status === 'disconnected' ||
     account.status === 'error' ||
     account.status === 'expired');
  return {
    loading,
    account,
    isUnhealthy,
    lastError: account?.last_error ?? null,
  };
}
