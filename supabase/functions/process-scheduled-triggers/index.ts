import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface DispatchResult { tenant_id: string; event: string; attempted: number; sent: number; skipped: number; failed: number; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: DispatchResult[] = [];

  const { data: tenants } = await supabase.from("tenants").select("id, name, currency");

  for (const tenant of tenants || []) {
    const { data: chAcc } = await supabase.from("channel_accounts")
      .select("id, status").eq("tenant_id", tenant.id).eq("channel", "whatsapp").eq("status", "connected").maybeSingle();
    if (!chAcc) continue;

    const { data: triggers } = await supabase.from("whatsapp_triggers")
      .select("id, event, is_enabled, delay_minutes, target_audience, template_id, template:whatsapp_templates(name, body_en, body_ar)")
      .eq("tenant_id", tenant.id).eq("is_enabled", true).in("event", ["rebook_reminder", "reengagement"]);
    if (!triggers?.length) continue;

    for (const trigger of triggers) {
      const result: DispatchResult = { tenant_id: tenant.id, event: trigger.event, attempted: 0, sent: 0, skipped: 0, failed: 0 };
      const candidates = trigger.event === "rebook_reminder"
        ? await findRebookCandidates(supabase, tenant.id)
        : await findReengagementCandidates(supabase, tenant.id);

      for (const c of candidates) {
        result.attempted++;
        const { data: existing } = await supabase.from("client_trigger_log").select("id")
          .eq("tenant_id", tenant.id).eq("client_id", c.client_id).eq("trigger_event", trigger.event)
          .gt("sent_at", new Date(Date.now() - 30 * 86400_000).toISOString()).maybeSingle();
        if (existing) { result.skipped++; continue; }

        const body = (trigger as any).template?.body_en ?? defaultBody(trigger.event);
        const message = renderTemplate(body, {
          client_name: c.client_name || "there", service_name: c.service_name || "your appointment",
          last_visit: c.last_visit?.slice(0, 10) || "", days_since: String(c.days_since || ""), salon_name: tenant.name,
        });

        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/channel-send`, {
            method: "POST",
            headers: { "content-type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ tenant_id: tenant.id, channel: "whatsapp", to: c.phone, text: message }),
          });
          if (!res.ok) {
            result.failed++;
            await supabase.from("client_trigger_log").insert({
              tenant_id: tenant.id, client_id: c.client_id, trigger_event: trigger.event,
              reference_id: c.reference_id ?? null, status: "failed", notes: `HTTP ${res.status}`,
            });
            continue;
          }
          result.sent++;
          await supabase.from("client_trigger_log").insert({
            tenant_id: tenant.id, client_id: c.client_id, trigger_event: trigger.event,
            reference_id: c.reference_id ?? null, status: "sent",
          });
        } catch { result.failed++; }
      }
      results.push(result);
    }
  }
  return json({ ok: true, results, ran_at: new Date().toISOString() });
});

interface Candidate {
  client_id: string; client_name: string; phone: string;
  service_id?: string; service_name?: string;
  last_visit?: string; days_since?: number; reference_id?: string;
}

async function findRebookCandidates(sb: any, tenantId: string): Promise<Candidate[]> {
  const { data: services } = await sb.from("services").select("id, name, rebook_after_days")
    .eq("tenant_id", tenantId).not("rebook_after_days", "is", null);
  if (!services?.length) return [];
  const cutoffMs = Date.now();
  const candidates: Candidate[] = [];

  for (const svc of services) {
    const targetCutoff = new Date(cutoffMs - svc.rebook_after_days * 86400_000).toISOString().slice(0, 10);
    const { data: bookings } = await sb.from("bookings")
      .select("id, client_id, booking_date, client:clients(id, name, phone)")
      .eq("tenant_id", tenantId).eq("service_id", svc.id).eq("status", "completed")
      .lte("booking_date", targetCutoff).order("booking_date", { ascending: false }).limit(500);
    if (!bookings?.length) continue;

    const byClient = new Map<string, any>();
    for (const b of bookings) { if (!b.client_id || byClient.has(b.client_id)) continue; byClient.set(b.client_id, b); }

    for (const [clientId, b] of byClient) {
      if (!b.client?.phone) continue;
      const { data: future } = await sb.from("bookings").select("id")
        .eq("tenant_id", tenantId).eq("client_id", clientId)
        .gte("booking_date", new Date().toISOString().slice(0, 10))
        .in("status", ["planned", "confirmed", "checked_in", "in_service"]).limit(1);
      if (future?.length) continue;

      const daysSince = Math.floor((cutoffMs - new Date(b.booking_date).getTime()) / 86400_000);
      candidates.push({
        client_id: clientId, client_name: b.client.name, phone: b.client.phone,
        service_id: svc.id, service_name: svc.name, last_visit: b.booking_date,
        days_since: daysSince, reference_id: svc.id,
      });
    }
  }
  return candidates;
}

async function findReengagementCandidates(sb: any, tenantId: string): Promise<Candidate[]> {
  const cutoff30d = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const { data: clients } = await sb.from("clients").select("id, name, phone")
    .eq("tenant_id", tenantId).not("phone", "is", null).limit(1000);
  if (!clients?.length) return [];

  const out: Candidate[] = [];
  for (const c of clients) {
    if (!c.phone) continue;
    const { data: latest } = await sb.from("bookings").select("booking_date")
      .eq("tenant_id", tenantId).eq("client_id", c.id).eq("status", "completed")
      .order("booking_date", { ascending: false }).limit(1).maybeSingle();
    if (!latest || latest.booking_date > cutoff30d) continue;

    const { data: future } = await sb.from("bookings").select("id")
      .eq("tenant_id", tenantId).eq("client_id", c.id)
      .gte("booking_date", new Date().toISOString().slice(0, 10))
      .in("status", ["planned", "confirmed", "checked_in", "in_service"]).limit(1);
    if (future?.length) continue;

    const daysSince = Math.floor((Date.now() - new Date(latest.booking_date).getTime()) / 86400_000);
    out.push({ client_id: c.id, client_name: c.name, phone: c.phone, last_visit: latest.booking_date, days_since: daysSince });
  }
  return out;
}

function defaultBody(event: string): string {
  switch (event) {
    case "rebook_reminder": return "Hi {{client_name}}! It's been {{days_since}} days since your last {{service_name}} at {{salon_name}}. Ready to book your next appointment?";
    case "reengagement":    return "Hi {{client_name}}! We miss you at {{salon_name}}. It's been {{days_since}} days since your last visit. Reply to book a fresh appointment.";
    default:                return "Hi {{client_name}}! {{salon_name}} would love to see you again.";
  }
}

function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? "");
}
