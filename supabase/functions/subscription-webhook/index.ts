// supabase/functions/subscription-webhook/index.ts
// ---------------------------------------------------------------
// MyFatoorah webhook / browser callback handler for ZAINA's own SaaS
// subscription invoices (NOT for client booking deposits — those are
// handled by myfatoorah-payment).
//
// Idempotent: activate_subscription() is keyed on provider_ref.
// Replays return the existing invoice id without doing anything else.
//
// Accepts either:
//  - MyFatoorah callback redirect (?paymentId=... in the query)
//  - A POST webhook payload containing { InvoiceId } or { Data: { InvoiceId } }
// ---------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MF_BASE = Deno.env.get("MYFATOORAH_API_URL") || "https://apitest.myfatoorah.com";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let invoiceId: string | null = null;
    let paymentId: string | null = url.searchParams.get("paymentId");
    let amountPaid: number | null = null;
    let raw: any = {};

    if (req.method === "POST") {
      raw = await req.json().catch(() => ({}));
      invoiceId = String(raw?.InvoiceId ?? raw?.Data?.InvoiceId ?? raw?.invoice_id ?? "") || null;
      paymentId = paymentId ?? (raw?.PaymentId ?? raw?.Data?.PaymentId ?? null);

      // Optional shared-secret check (configure as MYFATOORAH_WEBHOOK_SECRET)
      const secret = Deno.env.get("MYFATOORAH_WEBHOOK_SECRET");
      if (secret) {
        const got = req.headers.get("x-mf-secret") || req.headers.get("MyFatoorah-Signature") || "";
        if (got !== secret) return json({ error: "bad signature" }, 401);
      }
    }

    const MF_KEY = Deno.env.get("MYFATOORAH_SAAS_API_KEY") || Deno.env.get("MYFATOORAH_API_KEY");
    if (!MF_KEY) {
      console.error("subscription-webhook: MyFatoorah key not configured; acknowledging without action");
      return json({ ok: true, ignored: true, reason: "billing_not_configured" });
    }

    // If we only have paymentId, resolve to invoiceId + status via GetPaymentStatus
    let status = "Pending";
    if (paymentId) {
      const r = await fetch(`${MF_BASE}/v2/GetPaymentStatus`, {
        method: "POST",
        headers: { Authorization: `Bearer ${MF_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ Key: paymentId, KeyType: "PaymentId" }),
      });
      const b = await r.json().catch(() => ({}));
      if (b?.IsSuccess && b?.Data) {
        invoiceId = invoiceId ?? String(b.Data.InvoiceId ?? "");
        status = b.Data.InvoiceStatus || "Pending";
        amountPaid = Number(b.Data.InvoiceDisplayValue?.toString().replace(/[^0-9.]/g, "") || b.Data.InvoiceValue || 0);
        raw = { ...raw, mf_status: b.Data };
      }
    } else if (invoiceId) {
      // Verify via GetPaymentStatus by InvoiceId
      const r = await fetch(`${MF_BASE}/v2/GetPaymentStatus`, {
        method: "POST",
        headers: { Authorization: `Bearer ${MF_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ Key: invoiceId, KeyType: "InvoiceId" }),
      });
      const b = await r.json().catch(() => ({}));
      if (b?.IsSuccess && b?.Data) {
        status = b.Data.InvoiceStatus || "Pending";
        amountPaid = Number(b.Data.InvoiceValue || 0);
        raw = { ...raw, mf_status: b.Data };
      }
    }

    if (!invoiceId) {
      console.error("subscription-webhook: no invoice id resolvable", { raw });
      return json({ ok: true, ignored: true, reason: "no_invoice_id" });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up the pending invoice row to recover tenant + plan
    const { data: pending } = await sb.from("tenant_invoices")
      .select("id, tenant_id, plan_code, amount_kwd")
      .eq("provider_ref", invoiceId)
      .maybeSingle();

    if (!pending) {
      // Not our invoice (could be a client booking deposit landing here by mistake)
      return json({ ok: true, ignored: true });
    }

    if (status !== "Paid") {
      // Reflect non-paid status; don't activate
      await sb.from("tenant_invoices")
        .update({ status: status === "Failed" ? "failed" : "issued", raw, updated_at: new Date().toISOString() })
        .eq("id", pending.id);
      return json({ ok: true, status });
    }

    const now = new Date();
    const periodEnd = new Date(now); periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data: activatedId, error: rpcErr } = await sb.rpc("activate_subscription", {
      p_tenant_id: pending.tenant_id,
      p_plan_code: pending.plan_code,
      p_provider_ref: invoiceId,
      p_amount: amountPaid ?? Number(pending.amount_kwd),
      p_period_start: now.toISOString(),
      p_period_end: periodEnd.toISOString(),
    });
    if (rpcErr) return json({ error: rpcErr.message }, 500);

    // Stash raw payload
    await sb.from("tenant_invoices").update({ raw, updated_at: new Date().toISOString() })
      .eq("id", activatedId as unknown as string);

    return json({ ok: true, invoice_id: activatedId, status: "paid" });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
