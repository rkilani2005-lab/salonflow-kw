import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

// Cast to any to support tables not yet reflected in generated types
// (chart_of_accounts, journal_entries, journal_lines, ar_invoices, etc.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ── Types ──────────────────────────────────────────────────────

export interface Account {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  name_ar: string | null;
  account_type: 'asset'|'liability'|'equity'|'revenue'|'expense';
  account_subtype: string;
  parent_id: string | null;
  is_system: boolean;
  is_active: boolean;
  description: string | null;
  opening_balance: number;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  tenant_id: string;
  entry_number: string;
  entry_date: string;
  source: string;
  source_ref_id: string | null;
  source_ref_type: string | null;
  description: string;
  description_ar: string | null;
  is_posted: boolean;
  is_reversed: boolean;
  created_at: string;
  journal_lines?: JournalLine[];
}

export interface JournalLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
  client_id: string | null;
  supplier_id: string | null;
  account?: Account;
}

export interface ARInvoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  client_id: string | null;
  client_name: string;
  invoice_date: string;
  due_date: string;
  status: 'draft'|'sent'|'partial'|'paid'|'overdue'|'void';
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  currency: string;
  notes: string | null;
  created_at: string;
  items?: ARInvoiceItem[];
  payments?: ARPayment[];
}

export interface ARInvoiceItem {
  id: string;
  ar_invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_price: number;
  account_id: string | null;
}

export interface ARPayment {
  id: string;
  ar_invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  check_number: string | null;
  notes: string | null;
}

export interface ExpenseEntry {
  id: string;
  tenant_id: string;
  expense_number: string;
  expense_date: string;
  account_id: string | null;
  supplier_id: string | null;
  cost_type: 'direct'|'indirect';
  category: string;
  description: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft'|'pending_approval'|'approved'|'paid'|'rejected'|'accrued';
  is_accrual: boolean;
  accrual_period: string | null;
  payment_method: string | null;
  check_number: string | null;
  receipt_url: string | null;
  created_at: string;
  account?: Account;
}

export interface Loan {
  id: string;
  tenant_id: string;
  loan_number: string;
  lender_name: string;
  lender_type: string;
  principal: number;
  interest_rate: number;
  start_date: string;
  maturity_date: string | null;
  status: 'active'|'paid_off'|'defaulted'|'restructured';
  outstanding_balance: number;
  currency: string;
  notes: string | null;
  created_at: string;
  repayments?: LoanRepayment[];
}

export interface LoanRepayment {
  id: string;
  loan_id: string;
  payment_date: string;
  principal_payment: number;
  interest_payment: number;
  total_payment: number;
  check_number: string | null;
  reference_number: string | null;
  created_at: string;
}

export interface Check {
  id: string;
  tenant_id: string;
  check_number: string;
  check_date: string;
  payee_name: string;
  payee_type: string;
  amount: number;
  bank_name: string;
  bank_account: string | null;
  memo: string | null;
  status: 'draft'|'printed'|'issued'|'cleared'|'voided'|'bounced';
  issued_date: string | null;
  cleared_date: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  campaign_type: string;
  start_date: string;
  end_date: string | null;
  budget: number;
  actual_spend: number;
  revenue_generated: number;
  discount_value: number;
  discount_type: string;
  is_active: boolean;
  created_at: string;
}

// ── Chart of Accounts ──────────────────────────────────────────

export const useChartOfAccounts = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['coa', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, name_ar, type, normal_balance, is_active, parent_id, tenant_id')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return (data || []) as Account[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateAccount = () => {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: Partial<Account>) => {
      const { data: acc, error } = await supabase
        .from('chart_of_accounts')
        .insert({ ...data, tenant_id: tenant!.id })
        .select().single();
      if (error) throw error;
      return acc;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coa'] }); toast({ title: 'Account created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── Journal Entries ────────────────────────────────────────────

export const useJournalEntries = (from?: string, to?: string) => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['journal-entries', tenant?.id, from, to],
    queryFn: async () => {
      let q = supabase.from('journal_entries')
        .select('*, journal_lines(*, account:account_id(code,name,name_ar,account_type))')
        .eq('tenant_id', tenant!.id)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (from) q = q.gte('entry_date', from);
      if (to)   q = q.lte('entry_date', to);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as JournalEntry[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateJournalEntry = () => {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      entry_date: string; description: string; description_ar?: string;
      source?: string; lines: { account_id: string; debit: number; credit: number; description?: string }[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      // Get next JE number
      const year = new Date().getFullYear();
      const { data: existing } = await supabase
        .from('journal_entries')
        .select('entry_number')
        .eq('tenant_id', tenant!.id)
        .like('entry_number', `JE-${year}-%`)
        .order('entry_number', { ascending: false })
        .limit(1);
      const lastNum = existing?.[0]?.entry_number?.split('-')[2] || '0000';
      const nextNum = String(parseInt(lastNum) + 1).padStart(4, '0');
      const entry_number = `JE-${year}-${nextNum}`;

      const { data: je, error: jeErr } = await supabase
        .from('journal_entries')
        .insert({
          tenant_id: tenant!.id, entry_number,
          entry_date: input.entry_date,
          source: input.source || 'manual',
          description: input.description,
          description_ar: input.description_ar,
          is_posted: true,
          created_by: user?.id,
        }).select().single();
      if (jeErr) throw jeErr;

      const { error: linesErr } = await supabase.from('journal_lines').insert(
        input.lines.map(l => ({ ...l, journal_entry_id: je.id }))
      );
      if (linesErr) throw linesErr;
      return je;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journal-entries'] }); toast({ title: 'Journal entry posted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── Trial Balance ──────────────────────────────────────────────

export const useTrialBalance = (from?: string, to?: string) => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['trial-balance', tenant?.id, from, to],
    queryFn: async () => {
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, name_ar, type, normal_balance, is_active, parent_id, tenant_id')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('code');

      const { data: lines } = await supabase
        .from('journal_lines')
        .select('account_id, debit, credit, journal_entry:journal_entry_id(is_posted, entry_date)')
        .eq('journal_entry.is_posted', true);

      const balances: Record<string, { debit: number; credit: number }> = {};
      (lines || []).forEach((l: any) => {
        const je = l.journal_entry;
        if (!je?.is_posted) return;
        if (from && je.entry_date < from) return;
        if (to && je.entry_date > to) return;
        if (!balances[l.account_id]) balances[l.account_id] = { debit: 0, credit: 0 };
        balances[l.account_id].debit  += Number(l.debit);
        balances[l.account_id].credit += Number(l.credit);
      });

      return (accounts || []).map((a: Account) => {
        const b = balances[a.id] || { debit: 0, credit: 0 };
        const normalBalance = a.account_type === 'asset' || a.account_type === 'expense'
          ? b.debit - b.credit
          : b.credit - b.debit;
        return { ...a, totalDebit: b.debit, totalCredit: b.credit, balance: normalBalance + Number(a.opening_balance) };
      }).filter(a => a.totalDebit !== 0 || a.totalCredit !== 0 || a.opening_balance !== 0);
    },
    enabled: !!tenant?.id,
  });
};

// ── P&L (Income Statement) ─────────────────────────────────────

export const useProfitLoss = (from: string, to: string) => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['pnl', tenant?.id, from, to],
    queryFn: async () => {
      // ── Step 1: Try journal_lines (double-entry, most accurate) ──
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id,code,name,name_ar,account_type,account_subtype')
        .eq('tenant_id', tenant!.id)
        .in('account_type', ['revenue','expense']);

      const { data: lines } = await supabase
        .from('journal_lines')
        .select('account_id, debit, credit, journal_entry:journal_entry_id(is_posted, entry_date, tenant_id)')
        .eq('journal_entry.is_posted', true)
        .eq('journal_entry.tenant_id', tenant!.id);

      const balances: Record<string, number> = {};
      let hasJournalData = false;
      (lines || []).forEach((l: any) => {
        const je = l.journal_entry;
        if (!je?.is_posted || je.entry_date < from || je.entry_date > to) return;
        if (!balances[l.account_id]) balances[l.account_id] = 0;
        const acc = (accounts || []).find((a: any) => a.id === l.account_id);
        if (!acc) return;
        hasJournalData = true;
        balances[l.account_id] += acc.account_type === 'revenue'
          ? Number(l.credit) - Number(l.debit)
          : Number(l.debit)  - Number(l.credit);
      });

      if (hasJournalData) {
        // Journal entries exist → use them (accurate double-entry P&L)
        const revenue = (accounts || []).filter((a: any) => a.account_type === 'revenue')
          .map((a: any) => ({ ...a, amount: balances[a.id] || 0 })).filter(a => a.amount !== 0);
        const cogs = (accounts || []).filter((a: any) => a.account_type === 'expense' && a.account_subtype === 'cogs')
          .map((a: any) => ({ ...a, amount: balances[a.id] || 0 })).filter(a => a.amount !== 0);
        const opex = (accounts || []).filter((a: any) => a.account_type === 'expense' && a.account_subtype !== 'cogs')
          .map((a: any) => ({ ...a, amount: balances[a.id] || 0 })).filter(a => a.amount !== 0);
        const totalRevenue = revenue.reduce((s, a) => s + a.amount, 0);
        const totalCogs    = cogs.reduce((s, a) => s + a.amount, 0);
        const grossProfit  = totalRevenue - totalCogs;
        const totalOpex    = opex.reduce((s, a) => s + a.amount, 0);
        return { revenue, cogs, opex, totalRevenue, totalCogs, grossProfit, totalOpex, netIncome: grossProfit - totalOpex, source: 'journal' };
      }

      // ── Step 2: Fallback — read directly from transactions + expenses ──
      // This ensures P&L is never empty even without manual journal entries
      const [txnsRes, expensesRes] = await Promise.all([
        supabase.from('transactions')
          .select('grand_total, service_category, service_name, created_at')
          .eq('tenant_id', tenant!.id)
          .eq('status', 'completed')
          .gte('created_at', from + 'T00:00:00')
          .lte('created_at', to   + 'T23:59:59'),
        supabase.from('expense_entries')
          .select('total_amount, category, cost_type, description')
          .eq('tenant_id', tenant!.id)
          .in('status', ['approved','paid'])
          .gte('expense_date', from)
          .lte('expense_date', to),
      ]);

      // Group revenue by service category
      const revByCategory: Record<string, number> = {};
      (txnsRes.data || []).forEach((t: any) => {
        const key = t.service_category || 'other';
        revByCategory[key] = (revByCategory[key] || 0) + Number(t.grand_total);
      });
      const revenue = Object.entries(revByCategory).map(([cat, amount]) => ({
        id: cat, code: cat, name: cat.charAt(0).toUpperCase() + cat.slice(1) + ' Revenue',
        name_ar: null, account_type: 'revenue', account_subtype: 'service_revenue', amount,
      }));

      // Group expenses by cost_type
      const cogsArr: any[] = [];
      const opexArr: any[] = [];
      const expByCategory: Record<string, { amount: number; is_cogs: boolean }> = {};
      (expensesRes.data || []).forEach((e: any) => {
        const key = e.category || 'general';
        if (!expByCategory[key]) expByCategory[key] = { amount: 0, is_cogs: e.cost_type === 'direct' };
        expByCategory[key].amount += Number(e.total_amount);
      });
      Object.entries(expByCategory).forEach(([cat, { amount, is_cogs }]) => {
        const row = { id: cat, code: cat, name: cat.charAt(0).toUpperCase() + cat.slice(1), name_ar: null, account_type: 'expense', account_subtype: is_cogs ? 'cogs' : 'operating_expense', amount };
        is_cogs ? cogsArr.push(row) : opexArr.push(row);
      });

      const totalRevenue = revenue.reduce((s, a) => s + a.amount, 0);
      const totalCogs    = cogsArr.reduce((s, a) => s + a.amount, 0);
      const grossProfit  = totalRevenue - totalCogs;
      const totalOpex    = opexArr.reduce((s, a) => s + a.amount, 0);
      return { revenue, cogs: cogsArr, opex: opexArr, totalRevenue, totalCogs, grossProfit, totalOpex, netIncome: grossProfit - totalOpex, source: 'transactions' };
    },
    enabled: !!tenant?.id && !!from && !!to,
  });
};

// ── AR Invoices ────────────────────────────────────────────────

export const useARInvoices = (status?: string) => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['ar-invoices', tenant?.id, status],
    queryFn: async () => {
      let q = supabase.from('ar_invoices')
        .select('*, items:ar_invoice_items(*), payments:ar_payments(*)')
        .eq('tenant_id', tenant!.id)
        .order('invoice_date', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ARInvoice[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateARInvoice = () => {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<ARInvoice, 'id'|'tenant_id'|'balance_due'|'created_at'|'paid_amount'> & { items: Omit<ARInvoiceItem,'id'|'ar_invoice_id'>[] }) => {
      const { items, ...invoiceData } = input;
      const { data: { user } } = await supabase.auth.getUser();
      const year = new Date().getFullYear();
      const { data: existing } = await supabase.from('ar_invoices')
        .select('invoice_number').eq('tenant_id', tenant!.id)
        .like('invoice_number', `INV-${year}-%`).order('invoice_number', { ascending: false }).limit(1);
      const lastNum = existing?.[0]?.invoice_number?.split('-')[2] || '0000';
      const num = String(parseInt(lastNum) + 1).padStart(4, '0');

      const { data: inv, error: invErr } = await supabase.from('ar_invoices').insert({
        ...invoiceData, tenant_id: tenant!.id,
        invoice_number: `INV-${year}-${num}`, paid_amount: 0, created_by: user?.id,
      }).select().single();
      if (invErr) throw invErr;

      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from('ar_invoice_items')
          .insert(items.map(i => ({ ...i, ar_invoice_id: inv.id })));
        if (itemsErr) throw itemsErr;
      }
      return inv;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ar-invoices'] }); toast({ title: 'Invoice created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useRecordARPayment = () => {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<ARPayment,'id'> & { invoice_total: number; invoice_paid: number }) => {
      const { invoice_total, invoice_paid, ...paymentData } = input;
      const { data: { user } } = await supabase.auth.getUser();
      const newPaid = Number(invoice_paid) + Number(paymentData.amount);
      const newStatus = newPaid >= Number(invoice_total) ? 'paid' : 'partial';

      const { error: payErr } = await supabase.from('ar_payments')
        .insert({ ...paymentData, tenant_id: tenant!.id, created_by: user?.id });
      if (payErr) throw payErr;

      const { error: invErr } = await supabase.from('ar_invoices')
        .update({ paid_amount: newPaid, status: newStatus })
        .eq('id', paymentData.ar_invoice_id);
      if (invErr) throw invErr;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ar-invoices'] }); toast({ title: 'Payment recorded' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── Expenses ───────────────────────────────────────────────────

export const useExpenses = (from?: string, to?: string) => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['expenses', tenant?.id, from, to],
    queryFn: async () => {
      let q = supabase.from('expense_entries')
        .select('*, account:account_id(code,name,name_ar)')
        .eq('tenant_id', tenant!.id)
        .order('expense_date', { ascending: false });
      if (from) q = q.gte('expense_date', from);
      if (to)   q = q.lte('expense_date', to);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ExpenseEntry[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateExpense = () => {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<ExpenseEntry,'id'|'tenant_id'|'expense_number'|'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const year = new Date().getFullYear();
      const { data: existing } = await supabase.from('expense_entries')
        .select('expense_number').eq('tenant_id', tenant!.id)
        .like('expense_number', `EXP-${year}-%`).order('expense_number', { ascending: false }).limit(1);
      const lastNum = existing?.[0]?.expense_number?.split('-')[2] || '0000';
      const num = String(parseInt(lastNum) + 1).padStart(4, '0');

      const { data, error } = await supabase.from('expense_entries').insert({
        ...input, tenant_id: tenant!.id,
        expense_number: `EXP-${year}-${num}`, created_by: user?.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast({ title: 'Expense recorded' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── Loans ──────────────────────────────────────────────────────

export const useLoans = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['loans', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('loans')
        .select('*, repayments:loan_repayments(*)')
        .eq('tenant_id', tenant!.id)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Loan[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateLoan = () => {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<Loan,'id'|'tenant_id'|'created_at'>) => {
      const year = new Date().getFullYear();
      const { data: existing } = await supabase.from('loans')
        .select('loan_number').eq('tenant_id', tenant!.id)
        .like('loan_number', `LN-${year}-%`).order('loan_number', { ascending: false }).limit(1);
      const lastNum = existing?.[0]?.loan_number?.split('-')[2] || '0000';
      const num = String(parseInt(lastNum) + 1).padStart(4, '0');
      const { data, error } = await supabase.from('loans').insert({
        ...input, tenant_id: tenant!.id, loan_number: `LN-${year}-${num}`,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['loans'] }); toast({ title: 'Loan recorded' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useRecordLoanRepayment = () => {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<LoanRepayment,'id'|'created_at'> & { current_balance: number }) => {
      const { current_balance, ...rep } = input;
      const { data: { user } } = await supabase.auth.getUser();
      const { error: repErr } = await supabase.from('loan_repayments')
        .insert({ ...rep, tenant_id: tenant!.id, created_by: user?.id });
      if (repErr) throw repErr;
      const newBalance = Math.max(0, current_balance - rep.principal_payment);
      const { error: loanErr } = await supabase.from('loans')
        .update({ outstanding_balance: newBalance, status: newBalance === 0 ? 'paid_off' : 'active' })
        .eq('id', rep.loan_id);
      if (loanErr) throw loanErr;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['loans'] }); toast({ title: 'Repayment recorded' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── Checks ─────────────────────────────────────────────────────

export const useChecks = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['checks', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('checks')
        .select('id, check_number, payee, amount, bank_name, check_date, due_date, status, notes, tenant_id, created_at').eq('tenant_id', tenant!.id)
        .order('check_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Check[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateCheck = () => {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<Check,'id'|'tenant_id'|'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('checks')
        .insert({ ...input, tenant_id: tenant!.id, created_by: user?.id })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['checks'] }); toast({ title: 'Check created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useUpdateCheckStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status, cleared_date }: { id: string; status: Check['status']; cleared_date?: string }) => {
      const { error } = await supabase.from('checks')
        .update({ status, cleared_date: cleared_date || null, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['checks'] }); toast({ title: 'Check updated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── Campaigns ──────────────────────────────────────────────────

export const useCampaigns = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['campaigns', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('campaigns')
        .select('id, name, type, status, budget, start_date, end_date, target_audience, message_template, sent_count, tenant_id, created_at').eq('tenant_id', tenant!.id)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Campaign[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateCampaign = () => {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<Campaign,'id'|'tenant_id'|'created_at'|'actual_spend'|'revenue_generated'>) => {
      const { data, error } = await supabase.from('campaigns')
        .insert({ ...input, tenant_id: tenant!.id, actual_spend: 0, revenue_generated: 0 })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast({ title: 'Campaign created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── Finance Dashboard KPIs ─────────────────────────────────────

export const useFinanceKPIs = () => {
  const { tenant } = useAuth();
  const now = new Date();
  const from = format(startOfMonth(now), 'yyyy-MM-dd');
  const to   = format(endOfMonth(now), 'yyyy-MM-dd');
  const prevFrom = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
  const prevTo   = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['finance-kpis', tenant?.id, from],
    queryFn: async () => {
      const [revenue, prevRevenue, expenses, arOpen, loans, checks] = await Promise.all([
        supabase.from('transactions').select('grand_total').eq('status','completed')
          .eq('tenant_id', tenant!.id).gte('created_at', from).lte('created_at', to + 'T23:59:59'),
        supabase.from('transactions').select('grand_total').eq('status','completed')
          .eq('tenant_id', tenant!.id).gte('created_at', prevFrom).lte('created_at', prevTo + 'T23:59:59'),
        supabase.from('expense_entries').select('total_amount').eq('tenant_id', tenant!.id)
          .in('status',['approved','paid']).gte('expense_date', from).lte('expense_date', to),
        supabase.from('ar_invoices').select('balance_due').eq('tenant_id', tenant!.id)
          .in('status',['sent','partial','overdue']),
        supabase.from('loans').select('outstanding_balance').eq('tenant_id', tenant!.id).eq('status','active'),
        supabase.from('checks').select('amount').eq('tenant_id', tenant!.id)
          .in('status',['draft','printed','issued']),
      ]);

      const rev = (revenue.data||[]).reduce((s,t)=>s+Number(t.grand_total),0);
      const pRev= (prevRevenue.data||[]).reduce((s,t)=>s+Number(t.grand_total),0);
      const exp = (expenses.data||[]).reduce((s,e)=>s+Number(e.total_amount),0);
      const ar  = (arOpen.data||[]).reduce((s,i)=>s+Number(i.balance_due),0);
      const loan= (loans.data||[]).reduce((s,l)=>s+Number(l.outstanding_balance),0);
      const chk = (checks.data||[]).reduce((s,c)=>s+Number(c.amount),0);

      return {
        revenue: Math.round(rev*1000)/1000,
        prevRevenue: Math.round(pRev*1000)/1000,
        revChange: pRev > 0 ? Math.round(((rev-pRev)/pRev)*1000)/10 : 0,
        expenses: Math.round(exp*1000)/1000,
        netIncome: Math.round((rev-exp)*1000)/1000,
        arOpen: Math.round(ar*1000)/1000,
        outstandingLoans: Math.round(loan*1000)/1000,
        pendingChecks: Math.round(chk*1000)/1000,
        grossMargin: rev > 0 ? Math.round(((rev-exp)/rev)*10000)/100 : 0,
      };
    },
    enabled: !!tenant?.id,
    refetchInterval: 60_000,
  });
};

// ── Cost Centers ───────────────────────────────────────────────

export interface CostCenter {
  id: string; tenant_id: string; code: string; name: string;
  name_ar: string | null; description: string | null; is_active: boolean; created_at: string;
}

export const useCostCenters = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['cost-centers', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('cost_centers')
        .select('*').eq('tenant_id', tenant!.id).order('code');
      if (error) throw error;
      return (data || []) as CostCenter[];
    },
    enabled: !!tenant?.id,
  });
};

export const useUpsertCostCenter = () => {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (d: Partial<CostCenter> & { code: string; name: string }) => {
      const payload = { ...d, tenant_id: tenant!.id };
      const { error } = d.id
        ? await supabase.from('cost_centers').update(payload).eq('id', d.id)
        : await supabase.from('cost_centers').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cost-centers'] }); toast({ title: 'Cost center saved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteCostCenter = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cost_centers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cost-centers'] }); toast({ title: 'Deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── Profit Centers ─────────────────────────────────────────────

export interface ProfitCenter {
  id: string; tenant_id: string; code: string; name: string;
  name_ar: string | null; description: string | null; is_active: boolean; created_at: string;
}

export const useProfitCenters = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['profit-centers', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profit_centers')
        .select('*').eq('tenant_id', tenant!.id).order('code');
      if (error) throw error;
      return (data || []) as ProfitCenter[];
    },
    enabled: !!tenant?.id,
  });
};

export const useUpsertProfitCenter = () => {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (d: Partial<ProfitCenter> & { code: string; name: string }) => {
      const payload = { ...d, tenant_id: tenant!.id };
      const { error } = d.id
        ? await supabase.from('profit_centers').update(payload).eq('id', d.id)
        : await supabase.from('profit_centers').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profit-centers'] }); toast({ title: 'Profit center saved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteProfitCenter = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('profit_centers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profit-centers'] }); toast({ title: 'Deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ── GL Mappings ────────────────────────────────────────────────

export interface GLMapping {
  id: string; tenant_id: string; mapping_type: string; source_key: string;
  label: string | null; debit_account_id: string | null; credit_account_id: string | null;
  cost_center_id: string | null; profit_center_id: string | null;
  is_active: boolean; created_at: string; updated_at: string;
}

export const useGLMappings = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['gl-mappings', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_mappings')
        .select('*').eq('tenant_id', tenant!.id).order('mapping_type').order('source_key');
      if (error) throw error;
      return (data || []) as GLMapping[];
    },
    enabled: !!tenant?.id,
  });
};

export const useUpsertGLMapping = () => {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (d: Partial<GLMapping> & { mapping_type: string; source_key: string }) => {
      const payload = { ...d, tenant_id: tenant!.id, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('gl_mappings')
        .upsert(payload, { onConflict: 'tenant_id,mapping_type,source_key' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gl-mappings'] }); toast({ title: 'GL mapping saved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};
