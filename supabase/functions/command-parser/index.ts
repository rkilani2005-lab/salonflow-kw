// Reception AI command bar — parses a natural-language command into a structured
// action. We do NOT mutate state here; the frontend retains the confirmation step.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY        = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_AI_KEY  = (Deno.env.get("LOVABLE_AI_KEY") ?? Deno.env.get("LOVABLE_API_KEY"))!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You parse Kuwait salon reception commands into JSON.
Output ONLY valid JSON with this shape:
{
  "action": "book" | "checkin" | "reschedule" | "cancel" | "walkin" | "unknown",
  "client_name": string | null,
  "client_phone": string | null,
  "staff_name": string | null,
  "service_name": string | null,
  "date": "YYYY-MM-DD" | null,
  "time": "HH:MM" | null,
  "appointment_ref": string | null,
  "confidence": "high" | "medium" | "low",
  "summary": string
}
Rules:
- summary is one short English sentence the receptionist will see and confirm
- if you don't have enough info, set action=unknown and explain in summary
- relative dates allowed in input ("tomorrow","today"); resolve them using the provided current_date
- if user mentions "now" or "today" for time, fill time with the next reasonable round half-hour
- no fields beyond the schema; no commentary; no markdown fences`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { text, current_date, staff_list, service_list } = await req.json();
    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content:
          `current_date: ${current_date}\n` +
          `staff_options: ${JSON.stringify(staff_list ?? [])}\n` +
          `service_options: ${JSON.stringify(service_list ?? [])}\n` +
          `command: ${text}` },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Authorization": `Bearer ${LOVABLE_AI_KEY}` },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages, temperature: 0.1 }),
    });
    if (!aiResp.ok) return json({ error: "AI gateway error", status: aiResp.status }, 502);
    const aiJson = await aiResp.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch {
      return json({ action: "unknown", summary: "Couldn't understand. Try rephrasing.", confidence: "low" });
    }
    return json(parsed);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
