// supabase/functions/create-subscription-checkout/index.ts
// ---------------------------------------------------------------
// Tenant clicks "Upgrade" on the Subscription page.
// 1. Verify JWT, derive tenant_id from profile (NEVER from body).
// 2. Look up plan price + name from subscription_plans.
// 3. Call MyFatoorah SendPayment (sandbox by default).
// 4. Record a pending invoice keyed on the MyFatoorah InvoiceId
//    so the webhook can match it idempotently later.
// 5. Return PaymentURL.
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);

    const sbAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await sbAnon.auth.getUser();
    if (uErr || !user) return json({ error: "unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const planCode = String(body?.plan_code || "").trim();
    if (!planCode) return json({ error: "plan_code required" }, 400);

    // Service-role client for cross-tenant reads + secure RPC
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await sb.from("profiles")
      .select("tenant_id, email, full_name").eq("user_id", user.id).maybeSingle();
    if (!profile?.tenant_id) return json({ error: "no tenant" }, 403);

    const { data: tenant } = await sb.from("tenants")
      .select("id, name, owner_whatsapp").eq("id", profile.tenant_id).maybeSingle();
    if (!tenant) return json({ error: "tenant not found" }, 404);

    const { data: plan } = await sb.from("subscription_plans")
      .select("code, name, price_kwd").eq("code", planCode).eq("is_active", true).maybeSingle();
    if (!plan) return json({ error: "plan not found" }, 404);

    const MF_KEY = Deno.env.get("MYFATOORAH_SAAS_API_KEY") || Deno.env.get("MYFATOORAH_API_KEY");
    if (!MF_KEY) return json({ error: "MyFatoorah SaaS key not configured" }, 503);

    const origin = req.headers.get("origin") || "https://salonflow-kw.lovable.app";
    const customerPhone = (tenant.owner_whatsapp || "").replace(/\D/g, "").replace(/^965/, "");

    const mfPayload = {
      CustomerName: tenant.name || "ZAINA Tenant",
      DisplayCurrencyIso: "KWD",
      MobileCountryCode: "+965",
      CustomerMobile: customerPhone || "00000000",
      CustomerEmail: profile.email || "",
      InvoiceValue: Number(plan.price_kwd),
      Language: "EN",
      CallBackUrl: `${origin}/subscription?status=success`,
      ErrorUrl: `${origin}/subscription?status=failed`,
      CustomerReference: tenant.id,
      UserDefinedField: `plan:${plan.code}`,
      InvoiceItems: [{ ItemName: `ZAINA ${plan.name} — Monthly`, Quantity: 1, UnitPrice: Number(plan.price_kwd) }],
    };

    const mfRes = await fetch(`${MF_BASE}/v2/ExecutePayment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${MF_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ PaymentMethodId: 0, ...mfPayload }),
    });
    const mfBody = await mfRes.json().catch(() => ({}));
    if (!mfRes.ok || !mfBody?.IsSuccess) {
      return json({ error: mfBody?.Message || "MyFatoorah ExecutePayment failed", details: mfBody }, 502);
    }

    const invoiceId = String(mfBody.Data.InvoiceId);
    const paymentUrl = mfBody.Data.PaymentURL as string;

    // Record pending invoice (idempotent on provider_ref)
    await sb.rpc("record_pending_invoice", {
      p_tenant_id: tenant.id,
      p_plan_code: plan.code,
      p_provider_ref: invoiceId,
      p_amount: Number(plan.price_kwd),
    });

    return json({ ok: true, payment_url: paymentUrl, invoice_id: invoiceId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
