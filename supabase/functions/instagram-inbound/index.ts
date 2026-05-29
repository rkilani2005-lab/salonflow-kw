// supabase/functions/instagram-inbound/index.ts
// ---------------------------------------------------------------
// Meta Instagram webhook (Graph API v20).
//   GET  → hub.challenge verification (META_VERIFY_TOKEN)
//   POST → page-message events (entry[].messaging[])
//
// Mirrors the baileys-inbound contract:
//   - dedupe on Meta message id (`mid`)
//   - upsert conversation (channel='instagram', provider_chat_id=psid)
//   - insert message (direction='inbound')
//   - fire-and-forget dispatch to ai-reply with { message_id }
//
// Token-secret reads only — never touch RLS-protected client paths.
// ---------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN     = Deno.env.get("META_VERIFY_TOKEN") ?? "";
const APP_SECRET       = Deno.env.get("META_APP_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // ── GET: webhook verification ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200, headers: cors });
    }
    return new Response("forbidden", { status: 403, headers: cors });
  }

  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });

  // Raw body needed both for signature check and for parsing.
  const raw = await req.text();

  // Optional signature verification (only enforced when APP_SECRET configured).
  if (APP_SECRET) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const ok = await verifySig(raw, sig, APP_SECRET);
    if (!ok) return new Response("bad signature", { status: 401, headers: cors });
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch { return ok(); }

  // Log raw payload for debugging (best-effort).
  const { data: logRow } = await sb.from("webhook_logs").insert({
    provider: "meta_cloud",
    event_type: payload?.object ?? "instagram",
    payload,
  }).select("id").single().then((r: any) => r ?? { data: null });

  try {
    // Meta delivers a batch: entry[].messaging[]
    for (const entry of payload?.entry ?? []) {
      const pageId = String(entry?.id ?? "");
      if (!pageId) continue;

      // Resolve channel_accounts row by IG/page id.
      const { data: acct } = await sb.rpc("find_channel_account_by_provider", {
        p_provider: "meta_cloud",
        p_provider_account_id: pageId,
      });
      const account = Array.isArray(acct) ? acct[0] : acct;
      if (!account) continue; // not for us

      const events = entry?.messaging ?? entry?.changes?.[0]?.value?.messages ?? [];
      for (const ev of events) {
        // Standard messaging webhook shape
        const sender = ev?.sender?.id ?? ev?.from?.id;
        const recipient = ev?.recipient?.id ?? pageId;
        const mid       = ev?.message?.mid ?? ev?.message?.id ?? ev?.id;
        const text      = ev?.message?.text ?? ev?.text?.body ?? null;
        const echo      = ev?.message?.is_echo === true;
        if (echo || !sender || sender === pageId) continue;
        if (!text) continue; // skip non-text for v1

        // Dedupe on mid
        if (mid) {
          const { data: dup } = await sb.from("messages")
            .select("id").eq("external_message_id", mid).maybeSingle();
          if (dup) continue;
        }

        // Upsert conversation
        const { data: conv, error: cErr } = await sb.from("conversations").upsert({
          tenant_id: account.tenant_id,
          channel_account_id: account.id,
          channel: "instagram",
          provider_chat_id: sender,
          external_id: sender,
          display_name: "Instagram user",
          status: "open",
        }, { onConflict: "tenant_id,channel,provider_chat_id" })
          .select("id").single();
        if (cErr || !conv) continue;

        const { data: msgRow } = await sb.from("messages").insert({
          tenant_id: account.tenant_id,
          conversation_id: conv.id,
          direction: "inbound",
          sender_type: "client",
          sender_id: sender,
          content_type: "text",
          content: text,
          external_message_id: mid ?? null,
          status: "delivered",
          metadata: { instagram: ev },
        }).select("id").single();

        if (msgRow?.id) {
          fetch(`${SUPABASE_URL}/functions/v1/ai-reply`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ message_id: msgRow.id }),
          }).catch(e => console.error("[instagram-inbound ai-reply dispatch]", e));
        }
      }
    }

    if (logRow?.id) await sb.from("webhook_logs").update({ processed: true }).eq("id", logRow.id);
    return ok();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (logRow?.id) await sb.from("webhook_logs").update({ error: msg }).eq("id", logRow.id);
    console.error("[instagram-inbound]", msg);
    return ok(); // 200 so Meta doesn't retry-storm
  }
});

function ok() { return new Response("ok", { status: 200, headers: cors }); }

async function verifySig(raw: string, header: string, secret: string): Promise<boolean> {
  if (!header.startsWith("sha256=")) return false;
  const expected = header.slice(7);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  // constant-time-ish compare
  if (hex.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
