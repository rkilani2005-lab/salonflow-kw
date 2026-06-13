// supabase/functions/create-subscription-checkout/index.ts
// ---------------------------------------------------------------
// Tenant clicks "Upgrade" on the Subscription page.
// Returns HTTP 200 with { ok: boolean, ... } for ALL controlled
// error paths so the supabase-js client doesn't fall into its
// generic "non-2xx" error branch.
// ---------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MF_BASE = Deno.env.get("MYFATOORAH_API_URL") || "https://apitest.myfatoorah.com";

function ok(b: Record<string, unknown>) { return json({ ok: true, ...b }, 200); }
function fail(error: string, message: string, extra: Record<string, unknown> = {}) {
  return json({ ok: false, error, message, ...extra }, 200);
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SRV) {
      console.error("Missing SUPABASE env vars");
      return fail("server_misconfigured", "Server is missing required configuration.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "unauthenticated", message: "Please sign in again." }, 401);
    }

    const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await sbAnon.auth.getUser();
    if (uErr || !user) {
      return json({ ok: false, error: "unauthenticated", message: "Please sign in again." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const planCode = String(body?.plan_code || "").trim();
    if (!planCode) return fail("invalid_request", "plan_code is required");

    const sb = createClient(SUPABASE_URL, SUPABASE_SRV);

    const { data: profile } = await sb.from("profiles")
      .select("tenant_id, email, full_name").eq("user_id", user.id).maybeSingle();

    // Resolve tenant. Some accounts created by the older (non-atomic)
    // onboarding have a user_roles row but a null profiles.tenant_id, which
    // would wrongly read as "not linked to a workspace". Fall back to
    // user_roles and self-heal the profile link.
    let tenantId: string | null = profile?.tenant_id ?? null;
    if (!tenantId) {
      const { data: roleRow } = await sb.from("user_roles")
        .select("tenant_id").eq("user_id", user.id)
        .not("tenant_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(1).maybeSingle();
      if (roleRow?.tenant_id) {
        tenantId = roleRow.tenant_id;
        // Backfill so every other tenant-scoped feature works too.
        await sb.from("profiles")
          .update({ tenant_id: tenantId })
          .eq("user_id", user.id);
      }
    }
    if (!tenantId) return fail("no_tenant", "Your account is not linked to a tenant.");

    const { data: tenant } = await sb.from("tenants")
      .select("id, name, owner_whatsapp").eq("id", tenantId).maybeSingle();
    if (!tenant) return fail("no_tenant", "Tenant not found.");

    const { data: plan } = await sb.from("subscription_plans")
      .select("code, name, price_kwd").eq("code", planCode).eq("is_active", true).maybeSingle();
    if (!plan) return fail("plan_not_found", "The selected plan is no longer available.");

    // Already on this plan?
    const { data: currentSub } = await sb.from("tenant_subscriptions")
      .select("plan_code, status").eq("tenant_id", tenant.id)
      .in("status", ["active", "trialing"]).maybeSingle();
    if (currentSub?.plan_code === planCode && currentSub?.status === "active") {
      return fail("already_on_plan", "You're already on this plan.");
    }

    // Billing configured?
    const MF_KEY = Deno.env.get("MYFATOORAH_SAAS_API_KEY") || Deno.env.get("MYFATOORAH_API_KEY");
    if (!MF_KEY) {
      return fail("billing_not_configured", "Subscription billing is not yet activated for this environment.");
    }

    const origin = req.headers.get("origin") || "https://salonflow-kw.lovable.app";
    const customerPhone = (tenant.owner_whatsapp || "").replace(/\D/g, "").replace(/^965/, "");

    const mfPayload = {
      PaymentMethodId: 0,
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

    let mfRes: Response;
    let mfBody: any;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      mfRes = await fetch(`${MF_BASE}/v2/ExecutePayment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${MF_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(mfPayload),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      mfBody = await mfRes.json().catch(() => ({}));
    } catch (e) {
      console.error("MyFatoorah network error:", e);
      return fail("provider_error", "Payment provider is unreachable. Please try again in a moment.");
    }

    if (!mfRes.ok || !mfBody?.IsSuccess) {
      console.error("MyFatoorah ExecutePayment failed:", mfRes.status, mfBody);
      return fail("provider_error", mfBody?.Message || "Payment provider error. Please try again in a moment.", {
        details: mfBody?.ValidationErrors || null,
      });
    }

    const invoiceId = String(mfBody.Data.InvoiceId);
    const paymentUrl = mfBody.Data.PaymentURL as string;

    try {
      await sb.rpc("record_pending_invoice", {
        p_tenant_id: tenant.id,
        p_plan_code: plan.code,
        p_provider_ref: invoiceId,
        p_amount: Number(plan.price_kwd),
      });
    } catch (e) {
      console.error("record_pending_invoice failed:", e);
      // Non-fatal — webhook can still reconcile via provider_ref
    }

    return ok({ payment_url: paymentUrl, invoice_ref: invoiceId });
  } catch (e) {
    console.error("create-subscription-checkout unexpected:", e);
    return fail("unexpected", (e as Error).message || "Unexpected error");
  }
});
