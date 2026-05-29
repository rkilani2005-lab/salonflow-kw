// supabase/functions/channel-connect/index.ts
// ---------------------------------------------------------------
// Tenant clicks "Connect WhatsApp" in Settings > Channels.
// This function:
//   1. Creates or updates a channel_accounts row (provider=baileys)
//   2. Calls the Baileys service to start/resume the session
//   3. Returns the QR data URI (PNG base64) for the frontend to render
//
// When the tenant scans the QR, Baileys will POST to baileys-inbound
// with event='connection' status='connected' — at that point the
// channel_accounts row flips to 'connected'.
// ---------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "DELETE") return await handleDisconnect(req);

  try {
    const { channel = "whatsapp" } = await req.json().catch(() => ({}));
    if (channel !== "whatsapp") {
      return json({ error: "only whatsapp is supported on the baileys backend" }, 400);
    }



    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    const { data: membership } = await sb.from("profiles")
      .select("tenant_id").eq("user_id", user.id).maybeSingle();
    if (!membership?.tenant_id) return json({ error: "no tenant membership" }, 403);

    const tenantId = membership.tenant_id;

    // Upsert channel_accounts row. Its id becomes the Baileys session_id.
    const { data: chAcc, error: upErr } = await sb.from("channel_accounts")
      .upsert(
        { tenant_id: tenantId, channel: "whatsapp", provider: "baileys", status: "pending" },
        { onConflict: "tenant_id,channel" },
      )
      .select("id, status").single();

    if (upErr || !chAcc) return json({ error: upErr?.message ?? "upsert failed" }, 500);

    // Call Baileys service
    const BAILEYS_URL    = Deno.env.get("BAILEYS_SERVICE_URL");
    const BAILEYS_SECRET = Deno.env.get("BAILEYS_SHARED_SECRET");

    if (!BAILEYS_URL || !BAILEYS_SECRET) {
      // Service not deployed yet — return pending state so UI can show
      // "Baileys service not yet configured" without breaking.
      return json({
        channel_account_id: chAcc.id,
        status: "pending",
        qr: null,
        message: "Baileys service is not yet deployed. Set BAILEYS_SERVICE_URL env var.",
      });
    }

    const bRes = await fetch(`${BAILEYS_URL}/sessions/${chAcc.id}/start`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Baileys-Auth": BAILEYS_SECRET,
      },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    const body = await bRes.json().catch(() => ({}));

    if (!bRes.ok) {
      await sb.from("channel_accounts")
        .update({ status: "error", last_error: body?.error ?? `HTTP ${bRes.status}` })
        .eq("id", chAcc.id);
      return json({ error: body?.error ?? "baileys start failed" }, 502);
    }

    return json({
      channel_account_id: chAcc.id,
      status: body.status ?? "pending",
      qr: body.qr ?? null,
      phone: body.phone ?? null,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

// ---------------------------------------------------------------
// DELETE = tenant clicks "Disconnect" in Settings > Channels.
// Tears down the Baileys session (logout + wipe local auth keys)
// on the Railway side, then flips channel_accounts.status to
// 'disconnected'. The Baileys call is best-effort: if the bridge
// is unreachable we still update the DB so the UI is consistent.
// ---------------------------------------------------------------
async function handleDisconnect(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const channel = body?.channel ?? "whatsapp";

    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    const { data: membership } = await sb.from("profiles")
      .select("tenant_id").eq("user_id", user.id).maybeSingle();
    if (!membership?.tenant_id) return json({ error: "no tenant membership" }, 403);

    const tenantId = membership.tenant_id;

    const { data: chAcc } = await sb.from("channel_accounts")
      .select("id, status").eq("tenant_id", tenantId).eq("channel", channel).maybeSingle();
    if (!chAcc) return json({ error: "no channel account to disconnect" }, 404);

    // Best-effort Baileys teardown — if Railway is down or slow,
    // we still want the DB to reflect disconnected so the UI doesn't
    // get stuck. Timeout at 8s.
    const BAILEYS_URL    = Deno.env.get("BAILEYS_SERVICE_URL");
    const BAILEYS_SECRET = Deno.env.get("BAILEYS_SHARED_SECRET");
    if (BAILEYS_URL && BAILEYS_SECRET) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 8000);
        await fetch(`${BAILEYS_URL}/sessions/${chAcc.id}`, {
          method: "DELETE",
          headers: { "X-Baileys-Auth": BAILEYS_SECRET },
          signal: controller.signal,
        });
        clearTimeout(tid);
      } catch (e) {
        console.warn("[channel-connect/DELETE] baileys disconnect failed (non-fatal):", e);
      }
    }

    const { error: uErr } = await sb.from("channel_accounts")
      .update({
        status: "disconnected",
        last_sync_at: new Date().toISOString(),
        connected_at: null,
        last_error: null,
      })
      .eq("id", chAcc.id);
    if (uErr) return json({ error: uErr.message }, 500);

    return json({ ok: true, status: "disconnected" });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
}


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
