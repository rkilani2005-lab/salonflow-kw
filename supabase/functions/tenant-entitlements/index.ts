// supabase/functions/tenant-entitlements/index.ts
// Returns a tenant's plan + features + status. Used server-side by
// AI functions (ai-reply, daily-briefing) to gate expensive ops.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body?.tenant_id || "");
    if (!tenantId) return json({ error: "tenant_id required" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tenant } = await sb.from("tenants")
      .select("id, subscription_plan, is_trial, trial_ends_at, is_active")
      .eq("id", tenantId).maybeSingle();
    if (!tenant) return json({ error: "not found" }, 404);

    const { data: sub } = await sb.from("tenant_subscriptions")
      .select("plan_code, status, current_period_end, cancel_at_period_end")
      .eq("tenant_id", tenantId).maybeSingle();

    const planCode = sub?.plan_code || tenant.subscription_plan || "starter";
    const { data: plan } = await sb.from("subscription_plans")
      .select("code, name, price_kwd, features, seat_limit")
      .eq("code", planCode).maybeSingle();

    const trialActive = tenant.is_trial && tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date();
    const subActive = sub?.status === "active" && sub?.current_period_end && new Date(sub.current_period_end) > new Date();
    const effectiveStatus = subActive ? "active" : (trialActive ? "trialing" : (sub?.status || "expired"));

    return json({
      tenant_id: tenant.id,
      plan_code: planCode,
      plan_name: plan?.name,
      features: plan?.features || {},
      seat_limit: plan?.seat_limit ?? null,
      status: effectiveStatus,
      trial_ends_at: tenant.trial_ends_at,
      current_period_end: sub?.current_period_end ?? null,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
