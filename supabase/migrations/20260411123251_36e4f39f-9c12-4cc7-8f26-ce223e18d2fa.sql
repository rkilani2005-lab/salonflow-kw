
-- ============================================================
-- FINANCE TABLES
-- ============================================================

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  account_type TEXT NOT NULL DEFAULT 'expense',
  account_subtype TEXT DEFAULT '',
  normal_balance TEXT NOT NULL DEFAULT 'debit',
  parent_id UUID REFERENCES public.chart_of_accounts(id),
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  opening_balance NUMERIC(12,3) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view accounts" ON public.chart_of_accounts FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Finance staff can manage accounts" ON public.chart_of_accounts FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));
CREATE POLICY "Finance staff can update accounts" ON public.chart_of_accounts FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));

-- Journal Entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'manual',
  source_ref_id UUID,
  source_ref_type TEXT,
  description TEXT NOT NULL DEFAULT '',
  description_ar TEXT,
  is_posted BOOLEAN DEFAULT false,
  is_reversed BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view journal entries" ON public.journal_entries FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Finance staff can create journal entries" ON public.journal_entries FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));
CREATE POLICY "Finance staff can update journal entries" ON public.journal_entries FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));

-- Journal Lines
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  debit NUMERIC(12,3) DEFAULT 0,
  credit NUMERIC(12,3) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view journal lines" ON public.journal_lines FOR SELECT USING (EXISTS (SELECT 1 FROM journal_entries je WHERE je.id = journal_lines.journal_entry_id AND (je.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))));
CREATE POLICY "Finance staff can create journal lines" ON public.journal_lines FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM journal_entries je WHERE je.id = journal_lines.journal_entry_id AND je.tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant'))));

-- AR Invoices
CREATE TABLE IF NOT EXISTS public.ar_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  invoice_number TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  client_name TEXT NOT NULL DEFAULT '',
  client_phone TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  subtotal NUMERIC(12,3) DEFAULT 0,
  tax_amount NUMERIC(12,3) DEFAULT 0,
  discount_amount NUMERIC(12,3) DEFAULT 0,
  total_amount NUMERIC(12,3) DEFAULT 0,
  paid_amount NUMERIC(12,3) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ar_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view AR invoices" ON public.ar_invoices FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Finance staff can create AR invoices" ON public.ar_invoices FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));
CREATE POLICY "Finance staff can update AR invoices" ON public.ar_invoices FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));

-- AR Invoice Items
CREATE TABLE IF NOT EXISTS public.ar_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ar_invoice_id UUID NOT NULL REFERENCES public.ar_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,3) DEFAULT 0,
  total NUMERIC(12,3) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ar_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AR invoice items" ON public.ar_invoice_items FOR SELECT USING (EXISTS (SELECT 1 FROM ar_invoices inv WHERE inv.id = ar_invoice_items.ar_invoice_id AND (inv.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))));
CREATE POLICY "Finance staff can create AR invoice items" ON public.ar_invoice_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM ar_invoices inv WHERE inv.id = ar_invoice_items.ar_invoice_id AND inv.tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant'))));

-- AR Payments
CREATE TABLE IF NOT EXISTS public.ar_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ar_invoice_id UUID NOT NULL REFERENCES public.ar_invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  amount NUMERIC(12,3) NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ar_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AR payments" ON public.ar_payments FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Finance staff can create AR payments" ON public.ar_payments FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));

-- Expense Entries
CREATE TABLE IF NOT EXISTS public.expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  expense_number TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id UUID REFERENCES public.chart_of_accounts(id),
  category TEXT DEFAULT 'general',
  payee TEXT,
  description TEXT,
  amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  reference_number TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view expenses" ON public.expense_entries FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Finance staff can create expenses" ON public.expense_entries FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));
CREATE POLICY "Finance staff can update expenses" ON public.expense_entries FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));

-- Loans
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  loan_number TEXT NOT NULL,
  lender_name TEXT NOT NULL DEFAULT '',
  loan_type TEXT DEFAULT 'business',
  principal_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(6,3) DEFAULT 0,
  outstanding_balance NUMERIC(12,3) DEFAULT 0,
  monthly_payment NUMERIC(12,3) DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  maturity_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view loans" ON public.loans FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Finance staff can create loans" ON public.loans FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));
CREATE POLICY "Finance staff can update loans" ON public.loans FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));

-- Loan Repayments
CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  principal_payment NUMERIC(12,3) DEFAULT 0,
  interest_payment NUMERIC(12,3) DEFAULT 0,
  total_payment NUMERIC(12,3) DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view loan repayments" ON public.loan_repayments FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Finance staff can create loan repayments" ON public.loan_repayments FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));

-- Checks
CREATE TABLE IF NOT EXISTS public.checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  check_number TEXT NOT NULL,
  payee TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  bank_name TEXT,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view checks" ON public.checks FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Finance staff can create checks" ON public.checks FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));
CREATE POLICY "Finance staff can update checks" ON public.checks FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));

-- Cash Sessions
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  branch_id UUID REFERENCES public.branches(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'open',
  opening_balance NUMERIC(12,3) DEFAULT 0,
  closing_balance NUMERIC(12,3),
  opened_by UUID,
  opened_at TIMESTAMPTZ DEFAULT now(),
  opening_notes TEXT,
  closing_cash_counted NUMERIC(12,3),
  closing_knet_terminal NUMERIC(12,3),
  closing_card_terminal NUMERIC(12,3),
  closing_notes TEXT,
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  total_cash_sales NUMERIC(12,3) DEFAULT 0,
  total_knet_sales NUMERIC(12,3) DEFAULT 0,
  total_card_sales NUMERIC(12,3) DEFAULT 0,
  total_gift_sales NUMERIC(12,3) DEFAULT 0,
  total_cash_payouts NUMERIC(12,3) DEFAULT 0,
  total_refunds NUMERIC(12,3) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  cash_variance NUMERIC(12,3),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view cash sessions" ON public.cash_sessions FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Authorized staff can create cash sessions" ON public.cash_sessions FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'receptionist')));
CREATE POLICY "Authorized staff can update cash sessions" ON public.cash_sessions FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'receptionist')));

-- Session Payouts
CREATE TABLE IF NOT EXISTS public.session_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  paid_to TEXT,
  paid_by UUID,
  payout_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.session_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view session payouts" ON public.session_payouts FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Authorized staff can create payouts" ON public.session_payouts FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'receptionist')));

-- ============================================================
-- LOYALTY & PROMOTIONS
-- ============================================================

-- Loyalty Config
CREATE TABLE IF NOT EXISTS public.loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) UNIQUE,
  is_active BOOLEAN DEFAULT false,
  points_per_kwd NUMERIC(6,2) DEFAULT 1,
  redemption_rate NUMERIC(6,3) DEFAULT 0.01,
  min_redemption INTEGER DEFAULT 100,
  tier_vip_threshold INTEGER DEFAULT 500,
  tier_vvip_threshold INTEGER DEFAULT 2000,
  tiers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view loyalty config" ON public.loyalty_config FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Managers can manage loyalty config" ON public.loyalty_config FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));
CREATE POLICY "Managers can update loyalty config" ON public.loyalty_config FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

-- Loyalty Transactions
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  type TEXT NOT NULL DEFAULT 'earn',
  points INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER DEFAULT 0,
  note TEXT,
  booking_id UUID REFERENCES public.bookings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view loyalty transactions" ON public.loyalty_transactions FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Authorized staff can create loyalty transactions" ON public.loyalty_transactions FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'receptionist')));

-- Gift Cards
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  code TEXT NOT NULL,
  initial_balance NUMERIC(12,3) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,3) NOT NULL DEFAULT 0,
  recipient_name TEXT,
  recipient_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view gift cards" ON public.gift_cards FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Managers can create gift cards" ON public.gift_cards FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'cashier')));
CREATE POLICY "Managers can update gift cards" ON public.gift_cards FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'cashier')));

CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_cards_tenant_code ON public.gift_cards(tenant_id, code);

-- Promo Codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  code TEXT NOT NULL,
  name TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(10,3) NOT NULL DEFAULT 0,
  min_purchase NUMERIC(12,3) DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view promo codes" ON public.promo_codes FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Managers can create promo codes" ON public.promo_codes FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));
CREATE POLICY "Managers can update promo codes" ON public.promo_codes FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_tenant_code ON public.promo_codes(tenant_id, code);

-- ============================================================
-- PACKAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  service_id UUID REFERENCES public.services(id),
  sessions_total INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(12,3) NOT NULL DEFAULT 0,
  valid_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view service packages" ON public.service_packages FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Managers can create service packages" ON public.service_packages FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));
CREATE POLICY "Managers can update service packages" ON public.service_packages FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

CREATE TABLE IF NOT EXISTS public.client_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  package_id UUID NOT NULL REFERENCES public.service_packages(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  sessions_total INTEGER NOT NULL DEFAULT 0,
  sessions_used INTEGER DEFAULT 0,
  sessions_remaining INTEGER GENERATED ALWAYS AS (sessions_total - sessions_used) STORED,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'active',
  transaction_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view client packages" ON public.client_packages FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Authorized staff can create client packages" ON public.client_packages FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'receptionist')));
CREATE POLICY "Authorized staff can update client packages" ON public.client_packages FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'receptionist')));

CREATE TABLE IF NOT EXISTS public.package_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_package_id UUID NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id),
  transaction_id UUID,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.package_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view redemptions" ON public.package_redemptions FOR SELECT USING (EXISTS (SELECT 1 FROM client_packages cp WHERE cp.id = package_redemptions.client_package_id AND (cp.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))));
CREATE POLICY "Staff can create redemptions" ON public.package_redemptions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM client_packages cp WHERE cp.id = package_redemptions.client_package_id AND cp.tenant_id = get_user_tenant_id(auth.uid())));

-- ============================================================
-- STAFF ATTENDANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIME,
  check_out TIME,
  status TEXT DEFAULT 'present',
  notes TEXT,
  late_minutes INTEGER DEFAULT 0,
  early_leave_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, staff_id, date)
);
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view attendance" ON public.staff_attendance FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Managers can manage attendance" ON public.staff_attendance FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));
CREATE POLICY "Managers can update attendance" ON public.staff_attendance FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

-- ============================================================
-- STAFF COMMISSION RULES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  service_category TEXT,
  commission_type TEXT NOT NULL DEFAULT 'percentage',
  commission_value NUMERIC(10,3) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view commission rules" ON public.staff_commission_rules FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Managers can create commission rules" ON public.staff_commission_rules FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));
CREATE POLICY "Managers can update commission rules" ON public.staff_commission_rules FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));
CREATE POLICY "Managers can delete commission rules" ON public.staff_commission_rules FOR DELETE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

-- ============================================================
-- CLIENT FEEDBACK
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  client_id UUID REFERENCES public.clients(id),
  client_name TEXT NOT NULL DEFAULT '',
  client_phone TEXT,
  staff_id UUID REFERENCES public.staff(id),
  service_name TEXT,
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view feedback" ON public.client_feedback FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Staff can create feedback" ON public.client_feedback FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Managers can update feedback" ON public.client_feedback FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

-- ============================================================
-- BOOKING CONFIG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.booking_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) UNIQUE,
  slug TEXT,
  header_title TEXT,
  header_title_ar TEXT,
  welcome_msg TEXT,
  welcome_msg_ar TEXT,
  show_prices BOOLEAN DEFAULT true,
  show_staff BOOLEAN DEFAULT true,
  advance_booking_days INTEGER DEFAULT 30,
  min_notice_hours INTEGER DEFAULT 2,
  primary_color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view booking config" ON public.booking_config FOR SELECT USING (true);
CREATE POLICY "Managers can manage booking config" ON public.booking_config FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));
CREATE POLICY "Managers can update booking config" ON public.booking_config FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant ON public.journal_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_tenant ON public.ar_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_tenant ON public.expense_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_client ON public.loyalty_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_tenant_date ON public.staff_attendance(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_commission_rules_staff ON public.staff_commission_rules(staff_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_tenant ON public.client_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant ON public.cash_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_packages_client ON public.client_packages(client_id);
