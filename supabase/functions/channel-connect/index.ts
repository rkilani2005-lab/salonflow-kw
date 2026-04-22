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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

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

    const { data: membership } = await sb.from("tenant_users")
      .select("tenant_id, role").eq("user_id", user.id).maybeSingle();
    if (!membership) return json({ error: "no tenant membership" }, 403);

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
