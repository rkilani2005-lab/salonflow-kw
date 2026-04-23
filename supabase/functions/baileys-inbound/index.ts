// supabase/functions/baileys-inbound/index.ts
// ---------------------------------------------------------------
// Receives webhook events from the Baileys Node service.
// Three event types:
//   - "qr"        : Baileys emitted a fresh QR (used by channel-connect polling)
//   - "connection": status change (connected / disconnected / error)
//   - "message"   : new inbound message from a WhatsApp user
//
// Auth: requires matching X-Baileys-Auth header.
// ---------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-baileys-auth",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const expected = Deno.env.get("BAILEYS_WEBHOOK_SECRET");
  const got = req.headers.get("x-baileys-auth");
  if (!expected || got !== expected) {
    return new Response("unauthorized", { status: 401, headers: cors });
  }

  const payload = await req.json();
  const { event, session_id, tenant_id, data } = payload ?? {};

  // Always log raw for debugging
  const { data: logRow } = await sb.from("webhook_logs").insert({
    provider: "baileys",
    event_type: event,
    account_id: session_id,
    tenant_id,
    payload,
  }).select("id").single();

  try {
    if (event === "qr") {
      // channel-connect polls /sessions/:id for the QR — nothing to do here
      await markProcessed(logRow?.id);
      return ok();
    }

    if (event === "connection") {
      const status = data?.status === "connected" ? "connected"
                   : data?.status === "disconnected" ? "disconnected"
                   : "error";
      await sb.from("channel_accounts")
        .update({
          status,
          display_handle: data?.phone ? `+${data.phone}` : undefined,
          display_name: data?.push_name ?? undefined,
          connected_at: status === "connected" ? new Date().toISOString() : undefined,
          last_error: data?.error ?? null,
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", session_id);
      await markProcessed(logRow?.id);
      return ok();
    }

    if (event === "message") {
      if (data?.is_group) {          // ignore group chats for booking SaaS
        await markProcessed(logRow?.id);
        return ok();
      }
      const fromJid: string = data?.from_jid ?? "";
      const phone = fromJid.split("@")[0].replace(/\D/g, "");
      if (!phone) return ok();

      // Dedupe
      if (data?.message_id) {
        const { data: dup } = await sb.from("messages")
          .select("id").eq("external_message_id", data.message_id).maybeSingle();
        if (dup) return ok();
      }

      // Upsert conversation
      const { data: conv } = await sb.from("conversations").upsert({
        tenant_id,
        channel_account_id: session_id,
        channel: "whatsapp",
        provider_chat_id: fromJid,
        external_id: phone,
        display_name: data?.push_name ?? `+${phone}`,
        status: "open",
      }, { onConflict: "tenant_id,channel,provider_chat_id" })
        .select("id").single();

      if (!conv) throw new Error("conversation upsert failed");

      // Link to existing client by phone if present
      const { data: client } = await sb.from("clients")
        .select("id").eq("tenant_id", tenant_id)
        .or(`phone.eq.+${phone},phone.eq.${phone}`).maybeSingle();
      if (client) {
        await sb.from("conversations").update({ client_id: client.id }).eq("id", conv.id);
      }

      await sb.from("messages").insert({
        tenant_id,
        conversation_id: conv.id,
        direction: "inbound",
        sender_type: "client",
        sender_id: phone,
        content_type: data?.content_type ?? "text",
        content: data?.text ?? null,
        external_message_id: data?.message_id ?? null,
        status: "delivered",
        metadata: { baileys: data },
      });

      await markProcessed(logRow?.id);

      // TODO Phase 5: trigger AI agent if channel_accounts.ai_agent_enabled
      return ok();
    }

    await markProcessed(logRow?.id);
    return ok();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sb.from("webhook_logs").update({ error: msg }).eq("id", logRow?.id);
    return new Response(`logged: ${msg}`, { status: 200, headers: cors });  // 200 so Baileys doesn't retry forever
  }
});

async function markProcessed(id: number | undefined) {
  if (id !== undefined) await sb.from("webhook_logs").update({ processed: true }).eq("id", id);
}

function ok() {
  return new Response("ok", { status: 200, headers: cors });
}
