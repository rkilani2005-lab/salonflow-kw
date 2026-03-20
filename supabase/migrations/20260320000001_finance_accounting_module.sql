-- ============================================================
-- ZAINA Finance & Accounting Module
-- Full double-entry bookkeeping for GCC Ladies Salons
-- ============================================================

-- ── 1. Chart of Accounts ─────────────────────────────────────
CREATE TYPE public.account_type AS ENUM (
  'asset', 'liability', 'equity', 'revenue', 'expense'
);

CREATE TYPE public.account_subtype AS ENUM (
  -- Assets
  'current_asset', 'fixed_asset', 'bank', 'cash', 'accounts_receivable',
  -- Liabilities
  'current_liability', 'long_term_liability', 'accounts_payable', 'accrued_liability', 'loan_payable',
  -- Equity
  'owners_equity', 'retained_earnings',
  -- Revenue
  'service_revenue', 'product_revenue', 'other_revenue',
  -- Expenses
  'cogs', 'operating_expense', 'payroll', 'rent', 'marketing',
  'depreciation', 'interest_expense', 'other_expense'
);

CREATE TABLE public.chart_of_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,                    -- e.g. "1010"
  name          TEXT NOT NULL,                    -- "Cash - KWD"
  name_ar       TEXT,
  account_type  account_type NOT NULL,
  account_subtype account_subtype NOT NULL,
  parent_id     UUID REFERENCES public.chart_of_accounts(id),
  is_system     BOOLEAN NOT NULL DEFAULT false,   -- system accounts cannot be deleted
  is_active     BOOLEAN NOT NULL DEFAULT true,
  description   TEXT,
  opening_balance NUMERIC(14,3) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- ── 2. Fiscal Periods ────────────────────────────────────────
CREATE TABLE public.fiscal_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,             -- "March 2026"
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_closed     BOOLEAN NOT NULL DEFAULT false,
  closed_at     TIMESTAMPTZ,
  closed_by     UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Journal Entries (double-entry backbone) ───────────────
CREATE TYPE public.journal_source AS ENUM (
  'manual', 'pos_sale', 'vendor_invoice', 'vendor_payment',
  'expense', 'payroll', 'accrual', 'loan_disbursement',
  'loan_repayment', 'campaign', 'adjustment', 'opening_balance'
);

CREATE TABLE public.journal_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_number    TEXT NOT NULL,           -- JE-2026-0001
  entry_date      DATE NOT NULL,
  source          journal_source NOT NULL DEFAULT 'manual',
  source_ref_id   UUID,                    -- FK to POS transaction / vendor invoice / etc.
  source_ref_type TEXT,                    -- 'transaction', 'vendor_invoice', 'expense', ...
  description     TEXT NOT NULL,
  description_ar  TEXT,
  fiscal_period_id UUID REFERENCES public.fiscal_periods(id),
  is_posted       BOOLEAN NOT NULL DEFAULT false,
  is_reversed     BOOLEAN NOT NULL DEFAULT false,
  reversed_by     UUID REFERENCES public.journal_entries(id),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entry_number)
);

-- ── 4. Journal Lines (debit / credit) ────────────────────────
CREATE TABLE public.journal_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  debit           NUMERIC(14,3) NOT NULL DEFAULT 0,
  credit          NUMERIC(14,3) NOT NULL DEFAULT 0,
  description     TEXT,
  client_id       UUID REFERENCES public.clients(id),
  supplier_id     UUID REFERENCES public.suppliers(id),
  branch_id       UUID REFERENCES public.branches(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT debit_credit_not_both CHECK (NOT (debit > 0 AND credit > 0)),
  CONSTRAINT amount_positive CHECK (debit >= 0 AND credit >= 0)
);

-- ── 5. Accounts Receivable (Client Ledger) ───────────────────
CREATE TYPE public.ar_invoice_status AS ENUM (
  'draft', 'sent', 'partial', 'paid', 'overdue', 'void'
);

CREATE TABLE public.ar_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL,
  client_id       UUID REFERENCES public.clients(id),
  client_name     TEXT NOT NULL,
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL,
  status          ar_invoice_status NOT NULL DEFAULT 'draft',
  subtotal        NUMERIC(14,3) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,3) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,3) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,3) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(14,3) NOT NULL DEFAULT 0,
  balance_due     NUMERIC(14,3) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  currency        TEXT NOT NULL DEFAULT 'KWD',
  notes           TEXT,
  transaction_id  UUID REFERENCES public.transactions(id),  -- link to POS
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, invoice_number)
);

CREATE TABLE public.ar_invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ar_invoice_id   UUID NOT NULL REFERENCES public.ar_invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(14,3) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_price     NUMERIC(14,3) NOT NULL DEFAULT 0,
  account_id      UUID REFERENCES public.chart_of_accounts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ar_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ar_invoice_id   UUID NOT NULL REFERENCES public.ar_invoices(id),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  amount          NUMERIC(14,3) NOT NULL,
  payment_method  TEXT NOT NULL DEFAULT 'cash',   -- cash, knet, credit_card, bank_transfer, check
  reference_number TEXT,
  check_number    TEXT,
  bank_name       TEXT,
  notes           TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. Enhanced Expense Management ───────────────────────────
CREATE TYPE public.expense_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'paid', 'rejected', 'accrued'
);

CREATE TYPE public.cost_type AS ENUM (
  'direct',    -- COGS: materials, products used in services
  'indirect'   -- Overheads: rent, utilities, marketing
);

CREATE TABLE public.expense_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  expense_number  TEXT NOT NULL,
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id      UUID REFERENCES public.chart_of_accounts(id),
  supplier_id     UUID REFERENCES public.suppliers(id),
  cost_type       cost_type NOT NULL DEFAULT 'indirect',
  category        TEXT NOT NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(14,3) NOT NULL,
  tax_amount      NUMERIC(14,3) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,3) NOT NULL,
  status          expense_status NOT NULL DEFAULT 'draft',
  is_accrual      BOOLEAN NOT NULL DEFAULT false,     -- accrual vs cash basis
  accrual_period  TEXT,                               -- "2026-03" for March 2026
  payment_method  TEXT,
  check_number    TEXT,
  bank_name       TEXT,
  receipt_url     TEXT,
  approved_by     UUID REFERENCES auth.users(id),
  approved_at     TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  vendor_invoice_id UUID REFERENCES public.vendor_invoices(id),
  branch_id       UUID REFERENCES public.branches(id),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, expense_number)
);

-- ── 7. Loans & Financing ─────────────────────────────────────
CREATE TYPE public.loan_status AS ENUM (
  'active', 'paid_off', 'defaulted', 'restructured'
);

CREATE TABLE public.loans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  loan_number     TEXT NOT NULL,
  lender_name     TEXT NOT NULL,
  lender_type     TEXT NOT NULL DEFAULT 'bank',  -- bank, shareholder, family, other
  principal       NUMERIC(14,3) NOT NULL,
  interest_rate   NUMERIC(5,2) NOT NULL DEFAULT 0,  -- annual %
  start_date      DATE NOT NULL,
  maturity_date   DATE,
  status          loan_status NOT NULL DEFAULT 'active',
  outstanding_balance NUMERIC(14,3) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'KWD',
  notes           TEXT,
  liability_account_id UUID REFERENCES public.chart_of_accounts(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, loan_number)
);

CREATE TABLE public.loan_repayments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  payment_date    DATE NOT NULL,
  principal_payment NUMERIC(14,3) NOT NULL DEFAULT 0,
  interest_payment  NUMERIC(14,3) NOT NULL DEFAULT 0,
  total_payment     NUMERIC(14,3) NOT NULL,
  check_number    TEXT,
  bank_name       TEXT,
  reference_number TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 8. Campaign / Offers Ledger ──────────────────────────────
CREATE TABLE public.campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  name_ar         TEXT,
  campaign_type   TEXT NOT NULL DEFAULT 'discount',  -- discount, offer, loyalty, referral
  start_date      DATE NOT NULL,
  end_date        DATE,
  budget          NUMERIC(14,3) DEFAULT 0,
  actual_spend    NUMERIC(14,3) NOT NULL DEFAULT 0,
  revenue_generated NUMERIC(14,3) NOT NULL DEFAULT 0,
  discount_value  NUMERIC(10,3) DEFAULT 0,           -- KWD or %
  discount_type   TEXT DEFAULT 'percentage',          -- percentage | fixed
  is_active       BOOLEAN NOT NULL DEFAULT true,
  expense_account_id UUID REFERENCES public.chart_of_accounts(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 9. Check Register ────────────────────────────────────────
CREATE TYPE public.check_status AS ENUM (
  'draft', 'printed', 'issued', 'cleared', 'voided', 'bounced'
);

CREATE TABLE public.checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  check_number    TEXT NOT NULL,
  check_date      DATE NOT NULL,
  payee_name      TEXT NOT NULL,
  payee_type      TEXT NOT NULL DEFAULT 'supplier', -- supplier, employee, other
  payee_id        UUID,                              -- supplier_id or staff_id
  amount          NUMERIC(14,3) NOT NULL,
  bank_name       TEXT NOT NULL,
  bank_account    TEXT,
  memo            TEXT,
  status          check_status NOT NULL DEFAULT 'draft',
  issued_date     DATE,
  cleared_date    DATE,
  void_reason     TEXT,
  expense_id      UUID REFERENCES public.expense_entries(id),
  loan_repayment_id UUID REFERENCES public.loan_repayments(id),
  vendor_payment_id UUID REFERENCES public.vendor_payments(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, check_number)
);

-- ── 10. Budget ───────────────────────────────────────────────
CREATE TABLE public.budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  fiscal_period_id UUID NOT NULL REFERENCES public.fiscal_periods(id),
  budgeted_amount NUMERIC(14,3) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, account_id, fiscal_period_id)
);

-- ── 11. Indexes ──────────────────────────────────────────────
CREATE INDEX idx_coa_tenant ON public.chart_of_accounts(tenant_id);
CREATE INDEX idx_je_tenant_date ON public.journal_entries(tenant_id, entry_date);
CREATE INDEX idx_je_source ON public.journal_entries(source_ref_id, source_ref_type);
CREATE INDEX idx_jl_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX idx_jl_account ON public.journal_lines(account_id);
CREATE INDEX idx_ar_inv_tenant ON public.ar_invoices(tenant_id, invoice_date);
CREATE INDEX idx_ar_inv_client ON public.ar_invoices(client_id);
CREATE INDEX idx_expense_tenant ON public.expense_entries(tenant_id, expense_date);
CREATE INDEX idx_checks_tenant ON public.checks(tenant_id, check_date);
CREATE INDEX idx_loans_tenant ON public.loans(tenant_id);

-- ── 12. RLS Policies ─────────────────────────────────────────
ALTER TABLE public.chart_of_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_periods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_invoice_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets              ENABLE ROW LEVEL SECURITY;

-- Generic tenant-scoped policy macro (apply to each table)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chart_of_accounts','fiscal_periods','journal_entries','journal_lines',
    'ar_invoices','ar_invoice_items','ar_payments','expense_entries',
    'loans','loan_repayments','campaigns','checks','budgets'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "Tenant access" ON public.%I FOR ALL TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.profiles p
           WHERE p.user_id = auth.uid()
           AND p.tenant_id = %I.tenant_id
         ) OR is_super_admin(auth.uid())
       )
       WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.profiles p
           WHERE p.user_id = auth.uid()
           AND p.tenant_id = %I.tenant_id
         ) OR is_super_admin(auth.uid())
       )', t, t, t
    );
  END LOOP;
END;
$$;

-- ── 13. Helper: next journal entry number ────────────────────
CREATE OR REPLACE FUNCTION public.next_journal_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT := to_char(now(), 'YYYY');
  v_seq  INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(entry_number, '^JE-\d{4}-', ''), '')::INTEGER
  ), 0) + 1
  INTO v_seq
  FROM public.journal_entries
  WHERE tenant_id = p_tenant_id
    AND entry_number LIKE 'JE-' || v_year || '-%';
  RETURN 'JE-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

-- ── 14. Helper: account balance ──────────────────────────────
CREATE OR REPLACE FUNCTION public.account_balance(
  p_account_id UUID,
  p_from DATE DEFAULT NULL,
  p_to   DATE DEFAULT NULL
)
RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
  v_type  account_type;
  v_debit  NUMERIC(14,3) := 0;
  v_credit NUMERIC(14,3) := 0;
BEGIN
  SELECT a.account_type INTO v_type
  FROM public.chart_of_accounts a WHERE a.id = p_account_id;

  SELECT COALESCE(SUM(jl.debit),0), COALESCE(SUM(jl.credit),0)
  INTO v_debit, v_credit
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON je.id = jl.journal_entry_id
  WHERE jl.account_id = p_account_id
    AND je.is_posted = true
    AND (p_from IS NULL OR je.entry_date >= p_from)
    AND (p_to   IS NULL OR je.entry_date <= p_to);

  -- Normal balance: assets+expenses = debit; liabilities+equity+revenue = credit
  IF v_type IN ('asset','expense') THEN
    RETURN v_debit - v_credit;
  ELSE
    RETURN v_credit - v_debit;
  END IF;
END;
$$;

-- ── 15. Seed default Chart of Accounts for new tenants ───────
CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(p_tenant_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.chart_of_accounts(tenant_id, code, name, name_ar, account_type, account_subtype, is_system) VALUES
  -- Assets
  (p_tenant_id,'1000','Current Assets','الأصول المتداولة','asset','current_asset',true),
  (p_tenant_id,'1010','Cash - KWD','النقد - دينار','asset','cash',true),
  (p_tenant_id,'1020','Bank Account - KWD','الحساب البنكي - دينار','asset','bank',true),
  (p_tenant_id,'1030','Petty Cash','الصندوق','asset','cash',true),
  (p_tenant_id,'1100','Accounts Receivable','ذمم مدينة','asset','accounts_receivable',true),
  (p_tenant_id,'1200','Inventory - Products','مخزون المنتجات','asset','current_asset',true),
  (p_tenant_id,'1500','Fixed Assets','الأصول الثابتة','asset','fixed_asset',true),
  (p_tenant_id,'1510','Equipment','المعدات','asset','fixed_asset',false),
  (p_tenant_id,'1520','Furniture & Fixtures','الأثاث والتجهيزات','asset','fixed_asset',false),
  -- Liabilities
  (p_tenant_id,'2000','Current Liabilities','الالتزامات المتداولة','liability','current_liability',true),
  (p_tenant_id,'2010','Accounts Payable','ذمم دائنة','liability','accounts_payable',true),
  (p_tenant_id,'2020','Accrued Expenses','مصروفات مستحقة','liability','accrued_liability',true),
  (p_tenant_id,'2030','Sales Tax Payable','ضريبة مستحقة','liability','current_liability',true),
  (p_tenant_id,'2100','Loans Payable','قروض','liability','loan_payable',true),
  -- Equity
  (p_tenant_id,'3000','Owner''s Equity','حقوق الملكية','equity','owners_equity',true),
  (p_tenant_id,'3010','Owner''s Capital','رأس المال','equity','owners_equity',false),
  (p_tenant_id,'3100','Retained Earnings','الأرباح المحتجزة','equity','retained_earnings',true),
  -- Revenue
  (p_tenant_id,'4000','Revenue','الإيرادات','revenue','service_revenue',true),
  (p_tenant_id,'4010','Hair Services Revenue','إيرادات خدمات الشعر','revenue','service_revenue',false),
  (p_tenant_id,'4020','Nail Services Revenue','إيرادات خدمات الأظافر','revenue','service_revenue',false),
  (p_tenant_id,'4030','Facial & Skincare Revenue','إيرادات العناية بالبشرة','revenue','service_revenue',false),
  (p_tenant_id,'4040','Makeup Revenue','إيرادات المكياج','revenue','service_revenue',false),
  (p_tenant_id,'4050','Retail Product Sales','مبيعات منتجات التجزئة','revenue','product_revenue',false),
  (p_tenant_id,'4060','Other Revenue','إيرادات أخرى','revenue','other_revenue',false),
  -- Cost of Goods Sold
  (p_tenant_id,'5000','Cost of Goods Sold','تكلفة الخدمات','expense','cogs',true),
  (p_tenant_id,'5010','Products Used in Services','منتجات مستخدمة في الخدمات','expense','cogs',false),
  (p_tenant_id,'5020','Cost of Retail Products','تكلفة منتجات التجزئة','expense','cogs',false),
  -- Operating Expenses
  (p_tenant_id,'6000','Operating Expenses','مصروفات التشغيل','expense','operating_expense',true),
  (p_tenant_id,'6010','Staff Salaries','رواتب الموظفين','expense','payroll',false),
  (p_tenant_id,'6020','Staff Commissions','عمولات الموظفين','expense','payroll',false),
  (p_tenant_id,'6030','Rent','إيجار','expense','rent',false),
  (p_tenant_id,'6040','Utilities (Electricity/Water)','مرافق','expense','operating_expense',false),
  (p_tenant_id,'6050','Marketing & Advertising','تسويق وإعلانات','expense','marketing',false),
  (p_tenant_id,'6060','Supplies & Consumables','مستلزمات','expense','operating_expense',false),
  (p_tenant_id,'6070','Maintenance & Repairs','صيانة','expense','operating_expense',false),
  (p_tenant_id,'6080','Insurance','تأمين','expense','operating_expense',false),
  (p_tenant_id,'6090','Professional Fees','أتعاب مهنية','expense','operating_expense',false),
  (p_tenant_id,'6100','Depreciation','إهلاك','expense','depreciation',false),
  (p_tenant_id,'6110','Interest Expense','مصروف فوائد','expense','interest_expense',false),
  (p_tenant_id,'6120','Other Expenses','مصروفات أخرى','expense','other_expense',false)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

-- ── 16. Trigger: auto-post journal when POS transaction completes ──
CREATE OR REPLACE FUNCTION public.post_pos_journal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_je_id UUID;
  v_je_num TEXT;
  v_cash_acc UUID;
  v_revenue_acc UUID;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get system account IDs
    SELECT id INTO v_cash_acc FROM public.chart_of_accounts
    WHERE tenant_id = NEW.tenant_id AND code = '1010' LIMIT 1;
    SELECT id INTO v_revenue_acc FROM public.chart_of_accounts
    WHERE tenant_id = NEW.tenant_id AND code = '4000' LIMIT 1;

    IF v_cash_acc IS NOT NULL AND v_revenue_acc IS NOT NULL THEN
      v_je_num := public.next_journal_number(NEW.tenant_id);
      INSERT INTO public.journal_entries(tenant_id, entry_number, entry_date, source,
        source_ref_id, source_ref_type, description, is_posted)
      VALUES(NEW.tenant_id, v_je_num, CURRENT_DATE, 'pos_sale',
        NEW.id, 'transaction', 'POS Sale #' || v_je_num, true)
      RETURNING id INTO v_je_id;

      -- Debit Cash, Credit Revenue
      INSERT INTO public.journal_lines(journal_entry_id, account_id, debit, credit)
      VALUES
        (v_je_id, v_cash_acc,    NEW.grand_total, 0),
        (v_je_id, v_revenue_acc, 0, NEW.subtotal);

      -- If tax, credit tax payable
      IF NEW.tax_amount > 0 THEN
        DECLARE v_tax_acc UUID;
        BEGIN
          SELECT id INTO v_tax_acc FROM public.chart_of_accounts
          WHERE tenant_id = NEW.tenant_id AND code = '2030' LIMIT 1;
          IF v_tax_acc IS NOT NULL THEN
            INSERT INTO public.journal_lines(journal_entry_id, account_id, debit, credit)
            VALUES(v_je_id, v_tax_acc, 0, NEW.tax_amount);
          END IF;
        END;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pos_journal
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.post_pos_journal();

-- ── 17. Trigger: auto-post vendor invoice to AP ──────────────
CREATE OR REPLACE FUNCTION public.post_vendor_invoice_journal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_je_id UUID;
  v_je_num TEXT;
  v_ap_acc UUID;
  v_exp_acc UUID;
BEGIN
  IF NEW.status IN ('pending','partially_paid','paid') AND
     (OLD.status IS NULL OR OLD.status = 'pending') THEN
    SELECT id INTO v_ap_acc FROM public.chart_of_accounts
    WHERE tenant_id = NEW.tenant_id AND code = '2010' LIMIT 1;
    SELECT id INTO v_exp_acc FROM public.chart_of_accounts
    WHERE tenant_id = NEW.tenant_id AND code = '5010' LIMIT 1;

    IF v_ap_acc IS NOT NULL AND v_exp_acc IS NOT NULL THEN
      v_je_num := public.next_journal_number(NEW.tenant_id);
      INSERT INTO public.journal_entries(tenant_id, entry_number, entry_date, source,
        source_ref_id, source_ref_type, description, is_posted)
      VALUES(NEW.tenant_id, v_je_num, NEW.invoice_date, 'vendor_invoice',
        NEW.id, 'vendor_invoice', 'Vendor Invoice ' || NEW.invoice_number, true)
      RETURNING id INTO v_je_id;

      -- Debit Expense (COGS), Credit AP
      INSERT INTO public.journal_lines(journal_entry_id, account_id, debit, credit, supplier_id)
      VALUES
        (v_je_id, v_exp_acc, NEW.total_amount, 0, NEW.supplier_id),
        (v_je_id, v_ap_acc,  0, NEW.total_amount, NEW.supplier_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_invoice_journal
  AFTER INSERT OR UPDATE ON public.vendor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.post_vendor_invoice_journal();
