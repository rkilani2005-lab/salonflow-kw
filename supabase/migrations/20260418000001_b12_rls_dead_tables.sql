-- ============================================================
-- B.12  RLS fix — three tenant-scoped tables had RLS enabled but
--                  no policies, producing default-deny for everyone
--                  including the tenant that owns the rows.
--
-- Discovered in 20260320000001_finance_accounting_module.sql:
--     budgets          — referenced by the planned Budget Mgmt UI
--     campaigns        — actively referenced in src/hooks/useFinance.ts
--                        (line 683); campaign feature in app is dead
--                        without these policies
--     fiscal_periods   — referenced by the planned Fiscal Close UI
--
-- Fix: add tenant-scoped SELECT/INSERT/UPDATE/DELETE policies
-- mirroring the pattern used across every other tenant table
-- (uses get_user_tenant_id() helper for the current user's tenant).
--
-- No data loss possible: these tables currently return zero rows
-- to everyone; this migration adds access, does not remove any.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- budgets
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Tenant SELECT on budgets"
  ON public.budgets FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())
         OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant INSERT on budgets"
  ON public.budgets FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant UPDATE on budgets"
  ON public.budgets FOR UPDATE TO authenticated
  USING      (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant DELETE on budgets"
  ON public.budgets FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- campaigns
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Tenant SELECT on campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())
         OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant INSERT on campaigns"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant UPDATE on campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING      (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant DELETE on campaigns"
  ON public.campaigns FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- fiscal_periods
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Tenant SELECT on fiscal_periods"
  ON public.fiscal_periods FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())
         OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant INSERT on fiscal_periods"
  ON public.fiscal_periods FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant UPDATE on fiscal_periods"
  ON public.fiscal_periods FOR UPDATE TO authenticated
  USING      (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant DELETE on fiscal_periods"
  ON public.fiscal_periods FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));
