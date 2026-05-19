// Daily AI briefing — runs hourly via pg_cron; sends one brief per tenant whose
// send_hour matches the tenant's current local hour AND who hasn't been sent today.
//
// Triggered by:  SELECT cron.schedule('daily-briefing','0 * * * *',
//                  $$SELECT net.http_post(url:='<project>/functions/v1/daily-briefing',
//                                         headers:='{"Authorization":"Bearer <service_role>"}'::jsonb)$$);
// (Set this manually in Supabase SQL editor after deploy.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_AI_KEY") ?? Deno.env.get("LOVABLE_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  // Kuwait is GMT+3 with no DST. Treat all tenants as Asia/Kuwait for v1.
  const kuwaitHour = (new Date().getUTCHours() + 3) % 24;
  const today = new Date().toISOString().slice(0, 10);

  const { data: configs } = await admin
    .from("daily_briefing_config")
    .select("tenant_id, send_hour, recipient_phone, last_sent_date")
    .eq("enabled", true)
    .eq("send_hour", kuwaitHour);

  if (!configs?.length) return json({ ok: true, due: 0 });

  let sent = 0;
  for (const cfg of configs) {
    if (cfg.last_sent_date === today) continue;
    try {
      const brief = await buildBrief(admin, cfg.tenant_id);
      await sendBriefViaWhatsApp(cfg.tenant_id, cfg.recipient_phone, brief);
      await admin.from("daily_briefing_config")
        .update({ last_sent_date: today, last_brief: brief, updated_at: new Date().toISOString() })
        .eq("tenant_id", cfg.tenant_id);
      sent++;
    } catch (err) {
      console.error("brief failed for tenant", cfg.tenant_id, err);
    }
  }
  return json({ ok: true, due: configs.length, sent });
});

async function buildBrief(admin: any, tenantId: string): Promise<string> {
  const ystart = new Date(); ystart.setUTCDate(ystart.getUTCDate() - 1); ystart.setUTCHours(0,0,0,0);
  const yend   = new Date(ystart); yend.setUTCDate(yend.getUTCDate()+1);

  const [txnsR, bookingsR] = await Promise.all([
    admin.from("transactions")
      .select("total_amount, payment_status")
      .eq("tenant_id", tenantId)
      .gte("created_at", ystart.toISOString())
      .lt("created_at", yend.toISOString()),
    admin.from("bookings")
      .select("status")
      .eq("tenant_id", tenantId)
      .gte("start_time", ystart.toISOString())
      .lt("start_time", yend.toISOString()),
  ]);

  const { data: ls } = await admin.from("products")
    .select("name, current_stock, reorder_level")
    .eq("tenant_id", tenantId)
    .limit(50);
  const lowStockNames = (ls ?? [])
    .filter((p: any) => Number(p.current_stock) < Number(p.reorder_level))
    .slice(0, 5).map((p: any) => p.name);

  const revenue   = (txnsR.data ?? []).reduce((s: number, t: any) => s + Number(t.total_amount ?? 0), 0);
  const txnCount  = (txnsR.data ?? []).length;
  const bookings  = bookingsR.data ?? [];
  const noShows   = bookings.filter((b: any) => b.status === "no_show").length;
  const completed = bookings.filter((b: any) => b.status === "completed").length;

  const kpis = {
    revenue_kwd: revenue.toFixed(3),
    transactions: txnCount,
    completed_bookings: completed,
    no_shows: noShows,
    low_stock_items: lowStockNames,
  };

  if (!LOVABLE_AI_KEY) return defaultBrief(kpis);

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Authorization": `Bearer ${LOVABLE_AI_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content:
              "You are the operations briefer for a Kuwait salon. Produce a 3-sentence WhatsApp briefing in BOTH English AND Arabic, " +
              "separated by a blank line. Keep it positive but factual. Use KD for currency. No emojis." },
          { role: "user", content: `Yesterday's KPIs:\n${JSON.stringify(kpis, null, 2)}` },
        ],
      }),
    });
    if (!aiResp.ok) return defaultBrief(kpis);
    const aiJson = await aiResp.json();
    return aiJson?.choices?.[0]?.message?.content ?? defaultBrief(kpis);
  } catch {
    return defaultBrief(kpis);
  }
}

function defaultBrief(k: any): string {
  return `Yesterday: ${k.revenue_kwd} KD across ${k.transactions} sales, ${k.completed_bookings} completed bookings, ${k.no_shows} no-shows.` +
    (k.low_stock_items.length ? ` Low stock: ${k.low_stock_items.join(", ")}.` : "");
}

async function sendBriefViaWhatsApp(tenantId: string, phone: string | null, brief: string) {
  if (!phone) return;
  await fetch(`${SUPABASE_URL}/functions/v1/channel-send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ tenant_id: tenantId, to: phone, text: brief }),
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
