
-- ============================================================
-- Tenant isolation hardening
-- ============================================================

-- Helper: current_salon_id() — alias of get_user_tenant_id(auth.uid())
CREATE OR REPLACE FUNCTION public.current_salon_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.get_user_tenant_id(auth.uid()) $$;

GRANT EXECUTE ON FUNCTION public.current_salon_id() TO authenticated, anon, service_role;

-- ── NOT NULL where safe (no NULL rows present) ──────────────
ALTER TABLE public.clients      ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.webhook_logs ALTER COLUMN tenant_id SET NOT NULL;
-- services (13), staff (5), profiles (2) intentionally left nullable: orphaned rows exist;
-- RLS still excludes them. Cleanup can be done in a separate, reviewed migration.

-- ── Composite indexes for tenant-scoped query performance ───
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_created
  ON public.bookings (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_created
  ON public.transactions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_created
  ON public.clients (tenant_id, created_at DESC);

-- ── Fill RLS policy gaps (tables missing UPDATE/DELETE) ─────
-- ar_payments: had INSERT + SELECT only
DROP POLICY IF EXISTS "Tenant update on ar_payments" ON public.ar_payments;
CREATE POLICY "Tenant update on ar_payments" ON public.ar_payments
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_salon_id())
  WITH CHECK (tenant_id = public.current_salon_id());
DROP POLICY IF EXISTS "Tenant delete on ar_payments" ON public.ar_payments;
CREATE POLICY "Tenant delete on ar_payments" ON public.ar_payments
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_salon_id());

-- client_trigger_log: had SELECT only
DROP POLICY IF EXISTS "Tenant insert on client_trigger_log" ON public.client_trigger_log;
CREATE POLICY "Tenant insert on client_trigger_log" ON public.client_trigger_log
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_salon_id());
DROP POLICY IF EXISTS "Tenant update on client_trigger_log" ON public.client_trigger_log;
CREATE POLICY "Tenant update on client_trigger_log" ON public.client_trigger_log
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_salon_id())
  WITH CHECK (tenant_id = public.current_salon_id());
DROP POLICY IF EXISTS "Tenant delete on client_trigger_log" ON public.client_trigger_log;
CREATE POLICY "Tenant delete on client_trigger_log" ON public.client_trigger_log
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_salon_id());

-- goods_receipts: had INSERT + SELECT only
DROP POLICY IF EXISTS "Tenant update on goods_receipts" ON public.goods_receipts;
CREATE POLICY "Tenant update on goods_receipts" ON public.goods_receipts
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_salon_id())
  WITH CHECK (tenant_id = public.current_salon_id());
DROP POLICY IF EXISTS "Tenant delete on goods_receipts" ON public.goods_receipts;
CREATE POLICY "Tenant delete on goods_receipts" ON public.goods_receipts
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_salon_id());

-- inventory_transactions: had INSERT + SELECT only
DROP POLICY IF EXISTS "Tenant update on inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Tenant update on inventory_transactions" ON public.inventory_transactions
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_salon_id())
  WITH CHECK (tenant_id = public.current_salon_id());
DROP POLICY IF EXISTS "Tenant delete on inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Tenant delete on inventory_transactions" ON public.inventory_transactions
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_salon_id());

-- loan_repayments
DROP POLICY IF EXISTS "Tenant update on loan_repayments" ON public.loan_repayments;
CREATE POLICY "Tenant update on loan_repayments" ON public.loan_repayments
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_salon_id())
  WITH CHECK (tenant_id = public.current_salon_id());
DROP POLICY IF EXISTS "Tenant delete on loan_repayments" ON public.loan_repayments;
CREATE POLICY "Tenant delete on loan_repayments" ON public.loan_repayments
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_salon_id());

-- loyalty_transactions
DROP POLICY IF EXISTS "Tenant update on loyalty_transactions" ON public.loyalty_transactions;
CREATE POLICY "Tenant update on loyalty_transactions" ON public.loyalty_transactions
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_salon_id())
  WITH CHECK (tenant_id = public.current_salon_id());
DROP POLICY IF EXISTS "Tenant delete on loyalty_transactions" ON public.loyalty_transactions;
CREATE POLICY "Tenant delete on loyalty_transactions" ON public.loyalty_transactions
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_salon_id());

-- session_payouts
DROP POLICY IF EXISTS "Tenant update on session_payouts" ON public.session_payouts;
CREATE POLICY "Tenant update on session_payouts" ON public.session_payouts
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_salon_id())
  WITH CHECK (tenant_id = public.current_salon_id());
DROP POLICY IF EXISTS "Tenant delete on session_payouts" ON public.session_payouts;
CREATE POLICY "Tenant delete on session_payouts" ON public.session_payouts
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_salon_id());

-- vendor_payments
DROP POLICY IF EXISTS "Tenant update on vendor_payments" ON public.vendor_payments;
CREATE POLICY "Tenant update on vendor_payments" ON public.vendor_payments
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_salon_id())
  WITH CHECK (tenant_id = public.current_salon_id());
DROP POLICY IF EXISTS "Tenant delete on vendor_payments" ON public.vendor_payments;
CREATE POLICY "Tenant delete on vendor_payments" ON public.vendor_payments
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_salon_id());

-- owner_briefing_log: had SELECT only — typically written by edge functions (service_role),
-- but add tenant-scoped write policies for completeness
DROP POLICY IF EXISTS "Tenant insert on owner_briefing_log" ON public.owner_briefing_log;
CREATE POLICY "Tenant insert on owner_briefing_log" ON public.owner_briefing_log
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_salon_id());
