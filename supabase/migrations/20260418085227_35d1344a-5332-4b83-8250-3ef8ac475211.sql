-- ============================================================
-- B.12  RLS fix — Create missing tables and add RLS policies
-- ============================================================

-- Create budgets table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12,3) NOT NULL DEFAULT 0,
    spent_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    category TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaigns table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT NOT NULL DEFAULT 'email',
    start_date DATE,
    end_date DATE,
    budget_amount NUMERIC(12,3),
    spent_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
    target_audience TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fiscal_periods table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.fiscal_periods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all three tables
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- budgets RLS policies
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant SELECT on budgets' AND tablename = 'budgets') THEN
        CREATE POLICY "Tenant SELECT on budgets"
          ON public.budgets FOR SELECT TO authenticated
          USING (tenant_id = public.get_user_tenant_id(auth.uid())
                 OR public.is_super_admin(auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant INSERT on budgets' AND tablename = 'budgets') THEN
        CREATE POLICY "Tenant INSERT on budgets"
          ON public.budgets FOR INSERT TO authenticated
          WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant UPDATE on budgets' AND tablename = 'budgets') THEN
        CREATE POLICY "Tenant UPDATE on budgets"
          ON public.budgets FOR UPDATE TO authenticated
          USING      (tenant_id = public.get_user_tenant_id(auth.uid()))
          WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant DELETE on budgets' AND tablename = 'budgets') THEN
        CREATE POLICY "Tenant DELETE on budgets"
          ON public.budgets FOR DELETE TO authenticated
          USING (tenant_id = public.get_user_tenant_id(auth.uid()));
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- campaigns RLS policies
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant SELECT on campaigns' AND tablename = 'campaigns') THEN
        CREATE POLICY "Tenant SELECT on campaigns"
          ON public.campaigns FOR SELECT TO authenticated
          USING (tenant_id = public.get_user_tenant_id(auth.uid())
                 OR public.is_super_admin(auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant INSERT on campaigns' AND tablename = 'campaigns') THEN
        CREATE POLICY "Tenant INSERT on campaigns"
          ON public.campaigns FOR INSERT TO authenticated
          WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant UPDATE on campaigns' AND tablename = 'campaigns') THEN
        CREATE POLICY "Tenant UPDATE on campaigns"
          ON public.campaigns FOR UPDATE TO authenticated
          USING      (tenant_id = public.get_user_tenant_id(auth.uid()))
          WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant DELETE on campaigns' AND tablename = 'campaigns') THEN
        CREATE POLICY "Tenant DELETE on campaigns"
          ON public.campaigns FOR DELETE TO authenticated
          USING (tenant_id = public.get_user_tenant_id(auth.uid()));
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- fiscal_periods RLS policies
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant SELECT on fiscal_periods' AND tablename = 'fiscal_periods') THEN
        CREATE POLICY "Tenant SELECT on fiscal_periods"
          ON public.fiscal_periods FOR SELECT TO authenticated
          USING (tenant_id = public.get_user_tenant_id(auth.uid())
                 OR public.is_super_admin(auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant INSERT on fiscal_periods' AND tablename = 'fiscal_periods') THEN
        CREATE POLICY "Tenant INSERT on fiscal_periods"
          ON public.fiscal_periods FOR INSERT TO authenticated
          WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant UPDATE on fiscal_periods' AND tablename = 'fiscal_periods') THEN
        CREATE POLICY "Tenant UPDATE on fiscal_periods"
          ON public.fiscal_periods FOR UPDATE TO authenticated
          USING      (tenant_id = public.get_user_tenant_id(auth.uid()))
          WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant DELETE on fiscal_periods' AND tablename = 'fiscal_periods') THEN
        CREATE POLICY "Tenant DELETE on fiscal_periods"
          ON public.fiscal_periods FOR DELETE TO authenticated
          USING (tenant_id = public.get_user_tenant_id(auth.uid()));
    END IF;
END $$;

-- Create triggers for updated_at on all three tables
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_budgets_updated_at ON public.budgets;
CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fiscal_periods_updated_at ON public.fiscal_periods;
CREATE TRIGGER update_fiscal_periods_updated_at
  BEFORE UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();