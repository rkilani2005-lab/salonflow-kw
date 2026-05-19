import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY   = Deno.env.get("LOVABLE_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const SYSTEM_PROMPT = `You are a reception-desk command parser for a salon. The receptionist types a short
natural-language instruction; you return a structured JSON action plan they confirm
before execution.

Rules:
- Output ONLY valid JSON. No prose, no markdown, no code fences.
- If the request is ambiguous (e.g. "Sarah" matches 3 clients), return:
  {"status":"clarify","question":"Which Sarah? Al-Mutairi, Khaled, or Hassan?"}
- If the request is outside scope (anything not in the supported actions), return:
  {"status":"unsupported","reason":"<brief explanation>"}
- On success, return:
  {"status":"ok","summary":"<one-line plain English>","actions":[ ... ]}
  where each action is one of:
    {"type":"shift_bookings","booking_ids":["uuid",...],"delta_minutes":15}
    {"type":"mark_no_show","booking_id":"uuid"}
    {"type":"cancel_booking","booking_id":"uuid","reason":"text"}
    {"type":"send_message","booking_ids":["uuid",...],"text":"the message"}
    {"type":"rebook_client","client_id":"uuid","suggested_date":"YYYY-MM-DD","suggested_time":"HH:MM"}
- For "all 3 PM bookings", "all confirmed clients" etc., include all matching booking_ids from the context. Don't invent ids — use only ids in the context.
- For "notify clients about a 20 minute delay", the action type is "send_message" with a polite text the receptionist can edit before sending.
- Time deltas: negative delta = earlier, positive = later. Minutes only.
- Never include destructive actions (mark_no_show, cancel_booking) unless the command explicitly asks for them.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    const { data: profile } = await sb.from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    if (!profile?.tenant_id) return json({ error: "no tenant" }, 403);

    const body = await req.json().catch(() => ({}));
    const command: string = (body.command || "").toString().trim();
    const date: string = body.date || new Date().toISOString().slice(0, 10);
    if (!command) return json({ status: "unsupported", reason: "empty command" });

    const { data: bookings } = await sb.from("bookings")
      .select(`id, booking_date, start_time, status, client:clients(id, name, phone), service:services(name, duration), staff:staff(name)`)
      .eq("tenant_id", profile.tenant_id).eq("booking_date", date).order("start_time");

    const context = (bookings || []).map((b: any) => ({
      booking_id: b.id, time: b.start_time, status: b.status,
      client_id: b.client?.id, client: b.client?.name, phone: b.client?.phone,
      service: b.service?.name, duration_min: b.service?.duration, staff: b.staff?.name,
    }));

    if (!LOVABLE_API_KEY) return json({ status: "unsupported", reason: "AI gateway not configured" });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Date: ${date}\nBookings (today):\n${JSON.stringify(context, null, 2)}\n\nCommand: ${command}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) { const txt = await res.text(); return json({ status: "unsupported", reason: `AI gateway error: ${res.status}`, debug: txt }, 502); }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return json({ status: "unsupported", reason: "empty AI response" }, 502);

    let parsed: any;
    try { parsed = JSON.parse(content); } catch { return json({ status: "unsupported", reason: "invalid JSON from AI", raw: content }, 502); }

    const validIds = new Set(context.map(c => c.booking_id));
    if (Array.isArray(parsed.actions)) {
      for (const a of parsed.actions) {
        if (Array.isArray(a.booking_ids)) a.booking_ids = a.booking_ids.filter((id: string) => validIds.has(id));
        if (a.booking_id && !validIds.has(a.booking_id)) a.booking_id = null;
      }
      parsed.actions = parsed.actions.filter((a: any) => (a.booking_ids?.length ?? 1) > 0 && a.booking_id !== null);
    }
    return json(parsed);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
