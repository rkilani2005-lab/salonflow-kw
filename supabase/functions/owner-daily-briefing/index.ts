import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY           = Deno.env.get("LOVABLE_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const now = new Date();
  const utcHour = now.getUTCHours();
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yDate = yesterday.toISOString().slice(0, 10);

  const { data: tenants } = await supabase.from("tenants")
    .select("id, name, currency, owner_whatsapp, daily_briefing_hour, daily_briefing_enabled")
    .eq("daily_briefing_enabled", true).not("owner_whatsapp", "is", null);

  const results: any[] = [];

  for (const tenant of tenants || []) {
    const tenantUtcHour = ((tenant.daily_briefing_hour - 3) + 24) % 24;
    if (tenantUtcHour !== utcHour) continue;

    const { data: chAcc } = await supabase.from("channel_accounts").select("id, status")
      .eq("tenant_id", tenant.id).eq("channel", "whatsapp").eq("status", "connected").maybeSingle();
    if (!chAcc) { results.push({ tenant_id: tenant.id, status: "skipped", reason: "channel not connected" }); continue; }

    const { data: existing } = await supabase.from("owner_briefing_log").select("id")
      .eq("tenant_id", tenant.id).eq("briefing_date", yDate).maybeSingle();
    if (existing) { results.push({ tenant_id: tenant.id, status: "already_sent" }); continue; }

    const metrics = await gatherMetrics(supabase, tenant.id, yDate);
    const summary = await summarizeMetrics(metrics, tenant);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/channel-send`, {
        method: "POST",
        headers: { "content-type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ tenant_id: tenant.id, channel: "whatsapp", to: tenant.owner_whatsapp, text: summary }),
      });
      const status = res.ok ? "sent" : "failed";
      await supabase.from("owner_briefing_log").insert({
        tenant_id: tenant.id, briefing_date: yDate, summary_text: summary, metrics_json: metrics, status,
      });
      results.push({ tenant_id: tenant.id, status });
    } catch (err) {
      results.push({ tenant_id: tenant.id, status: "error", error: (err as Error).message });
    }
  }
  return json({ ok: true, ran_at_utc: now.toISOString(), results });
});

async function gatherMetrics(sb: any, tenantId: string, yDate: string) {
  const dayStart = `${yDate}T00:00:00.000Z`;
  const dayEnd   = `${yDate}T23:59:59.999Z`;

  const { data: txns } = await sb.from("transactions").select("grand_total, tip_amount, discount_amount")
    .eq("tenant_id", tenantId).eq("status", "completed").gte("created_at", dayStart).lte("created_at", dayEnd);

  const revenue   = (txns || []).reduce((s: number, t: any) => s + Number(t.grand_total || 0), 0);
  const tips      = (txns || []).reduce((s: number, t: any) => s + Number(t.tip_amount || 0), 0);
  const discounts = (txns || []).reduce((s: number, t: any) => s + Number(t.discount_amount || 0), 0);
  const txnCount  = (txns || []).length;

  const { data: bookings } = await sb.from("bookings").select("status")
    .eq("tenant_id", tenantId).eq("booking_date", yDate);
  const bookingTotal = (bookings || []).length;
  const noShows      = (bookings || []).filter((b: any) => b.status === "no_show").length;
  const completed    = (bookings || []).filter((b: any) => b.status === "completed").length;
  const cancelled    = (bookings || []).filter((b: any) => b.status === "cancelled").length;

  const today = new Date().toISOString().slice(0, 10);
  const { data: todayBookings } = await sb.from("bookings").select("status")
    .eq("tenant_id", tenantId).eq("booking_date", today);
  const todayPlanned = (todayBookings || []).filter((b: any) =>
    ["planned", "confirmed", "checked_in", "in_service"].includes(b.status)).length;

  const { data: earnings } = await sb.from("staff_commission_earnings")
    .select("staff_id, commission_amount, staff:staff(name)")
    .eq("tenant_id", tenantId).gte("created_at", dayStart).lte("created_at", dayEnd);
  const byStaff: Record<string, { name: string; total: number }> = {};
  for (const e of earnings || []) {
    const key = e.staff_id;
    if (!byStaff[key]) byStaff[key] = { name: (e as any).staff?.name || "Unknown", total: 0 };
    byStaff[key].total += Number(e.commission_amount || 0);
  }
  const topPerformer = Object.values(byStaff).sort((a, b) => b.total - a.total)[0];

  const { count: lowStockCount } = await sb.from("products").select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId).lt("current_stock", 5);

  return {
    yesterday: yDate,
    revenue: Math.round(revenue * 1000) / 1000,
    tips: Math.round(tips * 1000) / 1000,
    discounts: Math.round(discounts * 1000) / 1000,
    txn_count: txnCount,
    bookings_total: bookingTotal, bookings_completed: completed,
    bookings_no_show: noShows, bookings_cancelled: cancelled,
    today_planned: todayPlanned,
    top_performer: topPerformer ? { name: topPerformer.name, commission: Math.round(topPerformer.total * 1000) / 1000 } : null,
    low_stock_count: lowStockCount ?? 0,
  };
}

async function summarizeMetrics(metrics: any, tenant: any): Promise<string> {
  const fallback = buildFallbackSummary(metrics, tenant);
  if (!LOVABLE_API_KEY) return fallback;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content:
              `You are the salon owner's morning briefing assistant for "${tenant.name}". ` +
              `Write a concise WhatsApp message (max 8 short lines, friendly but professional). ` +
              `Start with 'Good morning!' then give yesterday's headline numbers, today's load, ` +
              `top performer, and ONE actionable observation. Use ${tenant.currency || "KWD"} for money. ` +
              `Use plain text only — no markdown asterisks. Use emojis sparingly (1-2 max).` },
          { role: "user", content: `Yesterday's data:\n${JSON.stringify(metrics, null, 2)}` },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || fallback;
  } catch { return fallback; }
}

function buildFallbackSummary(m: any, tenant: any): string {
  const cur = tenant.currency || "KWD";
  const lines = [
    `Good morning! Yesterday at ${tenant.name}:`,
    `Revenue: ${m.revenue} ${cur} (${m.txn_count} sales, ${m.tips} ${cur} tips)`,
    `Bookings: ${m.bookings_completed} completed, ${m.bookings_no_show} no-show, ${m.bookings_cancelled} cancelled`,
    m.top_performer ? `Top performer: ${m.top_performer.name} earned ${m.top_performer.commission} ${cur}` : "",
    `Today: ${m.today_planned} appointments planned`,
    m.low_stock_count > 0 ? `⚠️ ${m.low_stock_count} products low on stock — review reorder report.` : "",
  ].filter(Boolean);
  return lines.join("\n");
}
