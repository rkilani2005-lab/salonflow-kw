// supabase/functions/channel-send/index.ts
// ---------------------------------------------------------------
// Called from the ZAINA frontend or AI agent when staff replies or
// sends a booking confirmation. Forwards to Baileys service, then
// writes the outbound message row.
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
    const { conversation_id, text, media_url, media_type, sender_type = "staff" } =
      await req.json();
    if (!conversation_id || (!text && !media_url)) {
      return json({ error: "conversation_id and text|media_url required" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: conv, error: cErr } = await sb
      .from("conversations")
      .select(`
        id, tenant_id, external_id, provider_chat_id, channel,
        channel_account:channel_accounts!inner (
          id, provider, status
        )
      `)
      .eq("id", conversation_id)
      .single();

    if (cErr || !conv) return json({ error: "conversation not found" }, 404);

    const chAcc = Array.isArray(conv.channel_account) ? conv.channel_account[0] : conv.channel_account;
    if (!chAcc || chAcc.status !== "connected") {
      return json({ error: `channel is not connected (${chAcc?.status ?? "missing"})` }, 400);
    }

    if (chAcc.provider !== "baileys") {
      return json({ error: `provider ${chAcc.provider} not supported by this function` }, 400);
    }

    const BAILEYS_URL    = Deno.env.get("BAILEYS_SERVICE_URL");
    const BAILEYS_SECRET = Deno.env.get("BAILEYS_SHARED_SECRET");
    if (!BAILEYS_URL || !BAILEYS_SECRET) {
      return json({ error: "Baileys service not configured" }, 503);
    }

    // `to` is the WhatsApp JID — provider_chat_id if we stored it, else build from external_id
    const to = conv.provider_chat_id ?? `${(conv.external_id || "").replace(/\D/g, "")}@s.whatsapp.net`;

    const bRes = await fetch(`${BAILEYS_URL}/sessions/${chAcc.id}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Baileys-Auth": BAILEYS_SECRET,
      },
      body: JSON.stringify({ to, text, media_url, media_type, caption: media_url ? text : undefined }),
    });
    const body = await bRes.json().catch(() => ({}));

    if (!bRes.ok) {
      await sb.from("messages").insert({
        tenant_id: conv.tenant_id,
        conversation_id: conv.id,
        direction: "outbound",
        sender_type,
        content_type: media_url ? (media_type ?? "image") : "text",
        content: text ?? "[media]",
        status: "failed",
        error_message: body?.error ?? `HTTP ${bRes.status}`,
        metadata: { baileys_response: body },
      });
      return json({ error: body?.error ?? "baileys send failed" }, 502);
    }

    await sb.from("messages").insert({
      tenant_id: conv.tenant_id,
      conversation_id: conv.id,
      direction: "outbound",
      sender_type,
      content_type: media_url ? (media_type ?? "image") : "text",
      content: text ?? null,
      media_url: media_url ?? null,
      external_message_id: body?.message_id ?? null,
      status: "sent",
      metadata: { baileys_response: body },
    });

    await sb.from("conversations")
      .update({ unread_count: 0, status: "open" })
      .eq("id", conv.id);

    return json({ ok: true, message_id: body?.message_id });
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
