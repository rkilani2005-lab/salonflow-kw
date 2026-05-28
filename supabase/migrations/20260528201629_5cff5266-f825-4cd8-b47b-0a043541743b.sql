
-- =====================================================================
-- Phase 4A — Subscription billing tables + idempotent activation function
-- =====================================================================

-- ---- subscription_plans (catalog) -----------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  name_ar text,
  price_kwd numeric(10,3) NOT NULL,
  period text NOT NULL DEFAULT 'monthly',
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  seat_limit int,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_plans_read" ON public.subscription_plans;
CREATE POLICY "subscription_plans_read"
  ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_super_admin(auth.uid()));

-- Seed three plans (idempotent)
INSERT INTO public.subscription_plans (code, name, name_ar, price_kwd, period, features, seat_limit, sort_order)
VALUES
  ('starter',      'Starter', 'المبتدئ', 19.000, 'monthly',
   '{"branches":1,"pos":true,"calendar":true,"clients":true,"whatsapp_reminders":true,"inventory":false,"ai_agent":false,"advanced_reports":false}'::jsonb,
   3, 1),
  ('professional', 'Growth',  'النمو',   39.000, 'monthly',
   '{"branches":3,"pos":true,"calendar":true,"clients":true,"whatsapp_reminders":true,"inventory":true,"advanced_reports":true,"online_booking":true,"commissions":true,"ai_agent":false}'::jsonb,
   NULL, 2),
  ('ai',           'Pro',     'برو',     69.000, 'monthly',
   '{"branches":-1,"pos":true,"calendar":true,"clients":true,"whatsapp_reminders":true,"inventory":true,"advanced_reports":true,"online_booking":true,"commissions":true,"ai_agent":true,"ai_scheduling":true,"ai_inventory":true,"ai_intelligence":true,"daily_briefing":true}'::jsonb,
   NULL, 3)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name_ar = EXCLUDED.name_ar,
  price_kwd = EXCLUDED.price_kwd,
  features = EXCLUDED.features,
  seat_limit = EXCLUDED.seat_limit,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ---- tenant_subscriptions -------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.subscription_plans(code),
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider text NOT NULL DEFAULT 'myfatoorah',
  provider_ref text,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_subscriptions_read" ON public.tenant_subscriptions;
CREATE POLICY "tenant_subscriptions_read"
  ON public.tenant_subscriptions
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status
  ON public.tenant_subscriptions(tenant_id, status);

-- ---- tenant_invoices ------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.tenant_invoice_status AS ENUM ('issued','paid','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tenant_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  amount_kwd numeric(10,3) NOT NULL,
  currency text NOT NULL DEFAULT 'KWD',
  status public.tenant_invoice_status NOT NULL DEFAULT 'issued',
  issued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  plan_code text REFERENCES public.subscription_plans(code),
  provider text NOT NULL DEFAULT 'myfatoorah',
  provider_ref text UNIQUE,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tenant_invoices TO authenticated;
GRANT ALL ON public.tenant_invoices TO service_role;

ALTER TABLE public.tenant_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_invoices_read" ON public.tenant_invoices;
CREATE POLICY "tenant_invoices_read"
  ON public.tenant_invoices
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_tenant_invoices_tenant_status_date
  ON public.tenant_invoices(tenant_id, status, issued_at DESC);

-- ---- activate_subscription() — idempotent on provider_ref -----------
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_tenant_id uuid,
  p_plan_code text,
  p_provider_ref text,
  p_amount numeric,
  p_period_start timestamptz,
  p_period_end timestamptz
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_sub_id uuid;
BEGIN
  -- Idempotency guard — replays return the existing invoice
  SELECT id INTO v_invoice_id
    FROM public.tenant_invoices
   WHERE provider_ref = p_provider_ref
   LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN
    -- Ensure it's marked paid (in case original insert was 'issued')
    UPDATE public.tenant_invoices
       SET status = 'paid', paid_at = COALESCE(paid_at, now()), updated_at = now()
     WHERE id = v_invoice_id AND status <> 'paid';
    RETURN v_invoice_id;
  END IF;

  -- Upsert subscription
  INSERT INTO public.tenant_subscriptions
    (tenant_id, plan_code, status, current_period_start, current_period_end, provider, provider_ref, updated_at)
  VALUES
    (p_tenant_id, p_plan_code, 'active', p_period_start, p_period_end, 'myfatoorah', p_provider_ref, now())
  ON CONFLICT (tenant_id) DO UPDATE SET
    plan_code = EXCLUDED.plan_code,
    status = 'active',
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    provider = 'myfatoorah',
    provider_ref = EXCLUDED.provider_ref,
    cancel_at_period_end = false,
    updated_at = now()
  RETURNING id INTO v_sub_id;

  -- Insert paid invoice
  INSERT INTO public.tenant_invoices
    (tenant_id, subscription_id, amount_kwd, currency, status, issued_at, paid_at,
     period_start, period_end, plan_code, provider, provider_ref)
  VALUES
    (p_tenant_id, v_sub_id, p_amount, 'KWD', 'paid', now(), now(),
     p_period_start, p_period_end, p_plan_code, 'myfatoorah', p_provider_ref)
  RETURNING id INTO v_invoice_id;

  -- Reflect on tenants
  UPDATE public.tenants
     SET subscription_plan = p_plan_code::subscription_plan,
         is_trial = false,
         trial_ends_at = NULL,
         is_active = true,
         updated_at = now()
   WHERE id = p_tenant_id;

  RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_subscription(uuid, text, text, numeric, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid, text, text, numeric, timestamptz, timestamptz) TO service_role;

-- ---- record_pending_invoice() — called when a checkout is created ----
CREATE OR REPLACE FUNCTION public.record_pending_invoice(
  p_tenant_id uuid,
  p_plan_code text,
  p_provider_ref text,
  p_amount numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.tenant_invoices
    (tenant_id, amount_kwd, currency, status, issued_at, plan_code, provider, provider_ref)
  VALUES
    (p_tenant_id, p_amount, 'KWD', 'issued', now(), p_plan_code, 'myfatoorah', p_provider_ref)
  ON CONFLICT (provider_ref) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_pending_invoice(uuid, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_pending_invoice(uuid, text, text, numeric) TO service_role;
