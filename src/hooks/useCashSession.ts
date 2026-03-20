import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────

export interface CashSession {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  session_date: string;
  status: 'open' | 'closed';
  opening_balance: number;
  opened_by: string | null;
  opened_at: string;
  opening_notes: string | null;
  closing_cash_counted: number | null;
  closing_knet_terminal: number | null;
  closing_card_terminal: number | null;
  closing_notes: string | null;
  closed_by: string | null;
  closed_at: string | null;
  total_cash_sales: number;
  total_knet_sales: number;
  total_card_sales: number;
  total_gift_sales: number;
  total_cash_payouts: number;
  total_refunds: number;
  transaction_count: number;
  cash_variance: number | null;
  created_at: string;
  updated_at: string;
}

export interface SessionPayout {
  id: string;
  session_id: string;
  tenant_id: string;
  amount: number;
  reason: string;
  paid_to: string | null;
  paid_by: string | null;
  payout_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────

/** Pull payment-method totals from transactions for a given date */
async function fetchDayTotals(tenantId: string, sessionDate: string) {
  const dateStart = `${sessionDate}T00:00:00`;
  const dateEnd   = `${sessionDate}T23:59:59`;

  // All completed transactions for today
  const { data: txns } = await supabase
    .from('transactions')
    .select('id, grand_total, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .gte('created_at', dateStart)
    .lte('created_at', dateEnd);

  const txnIds = (txns || []).map(t => t.id);

  let cashSales = 0, knetSales = 0, cardSales = 0, giftSales = 0;
  let refunds = 0;
  let txnCount = (txns || []).length;

  if (txnIds.length > 0) {
    const { data: payments } = await supabase
      .from('transaction_payments')
      .select('payment_method, amount, transaction_id')
      .in('transaction_id', txnIds);

    for (const p of payments || []) {
      const amt = Number(p.amount);
      if (p.payment_method === 'cash')        cashSales += amt;
      else if (p.payment_method === 'knet')   knetSales += amt;
      else if (p.payment_method === 'credit_card') cardSales += amt;
      else if (p.payment_method === 'gift_card')   giftSales += amt;
    }
  }

  // Refunds issued today
  const { data: refundTxns } = await supabase
    .from('transactions')
    .select('grand_total')
    .eq('tenant_id', tenantId)
    .eq('status', 'refunded')
    .gte('created_at', dateStart)
    .lte('created_at', dateEnd);

  for (const r of refundTxns || []) {
    refunds += Math.abs(Number(r.grand_total));
  }

  return { cashSales, knetSales, cardSales, giftSales, refunds, txnCount };
}

// ── Hooks ───────────────────────────────────────────────────────

/** Get today's session for the current branch */
export function useTodaySession() {
  const { tenant, currentBranch } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['cash-session-today', tenant?.id, currentBranch?.id, today],
    queryFn: async () => {
      let q = supabase
        .from('cash_sessions')
        .select('*, payouts:session_payouts(*)')
        .eq('tenant_id', tenant!.id)
        .eq('session_date', today);

      if (currentBranch?.id) q = q.eq('branch_id', currentBranch.id);

      const { data } = await q.maybeSingle();
      return data as (CashSession & { payouts: SessionPayout[] }) | null;
    },
    enabled: !!tenant?.id,
    refetchInterval: 30_000,
  });
}

/** Get session history (last 30 days) */
export function useSessionHistory() {
  const { tenant, currentBranch } = useAuth();

  return useQuery({
    queryKey: ['cash-sessions-history', tenant?.id, currentBranch?.id],
    queryFn: async () => {
      let q = supabase
        .from('cash_sessions')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('session_date', { ascending: false })
        .limit(30);

      if (currentBranch?.id) q = q.eq('branch_id', currentBranch.id);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CashSession[];
    },
    enabled: !!tenant?.id,
  });
}

/** Open the day */
export function useOpenDay() {
  const { tenant, currentBranch } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { opening_balance: number; opening_notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const today = format(new Date(), 'yyyy-MM-dd');

      // Guard: check no session already open today for this branch
      let checkQ = supabase
        .from('cash_sessions')
        .select('id, status')
        .eq('tenant_id', tenant!.id)
        .eq('session_date', today);
      if (currentBranch?.id) checkQ = checkQ.eq('branch_id', currentBranch.id);
      const { data: existing } = await checkQ.maybeSingle();

      if (existing) {
        throw new Error(
          existing.status === 'open'
            ? 'A session is already open for today. Close it before opening a new one.'
            : 'Today\'s session has already been closed.'
        );
      }

      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          tenant_id:       tenant!.id,
          branch_id:       currentBranch?.id || null,
          session_date:    today,
          status:          'open',
          opening_balance: input.opening_balance,
          opened_by:       user?.id,
          opened_at:       new Date().toISOString(),
          opening_notes:   input.opening_notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session-today'] });
      queryClient.invalidateQueries({ queryKey: ['cash-sessions-history'] });
      toast({ title: '🟢 Day opened', description: 'Cash drawer session started.' });
    },
    onError: (e: any) => toast({ title: 'Cannot open day', description: e.message, variant: 'destructive' }),
  });
}

/** Close the day */
export function useCloseDay() {
  const { tenant, currentBranch } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      closing_cash_counted: number;
      closing_knet_terminal: number;
      closing_card_terminal: number;
      closing_notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch live totals from transactions
      const totals = await fetchDayTotals(tenant!.id, today);

      // Fetch payouts sum
      const { data: payouts } = await supabase
        .from('session_payouts')
        .select('amount')
        .eq('session_id', input.session_id);
      const totalPayouts = (payouts || []).reduce((s, p) => s + Number(p.amount), 0);

      // Fetch opening balance
      const { data: session } = await supabase
        .from('cash_sessions')
        .select('opening_balance, status')
        .eq('id', input.session_id)
        .single();

      if (!session) throw new Error('Session not found');
      if (session.status === 'closed') throw new Error('Session is already closed');

      const expectedCash =
        Number(session.opening_balance) + totals.cashSales - totalPayouts;
      const variance = input.closing_cash_counted - expectedCash;

      const { data, error } = await supabase
        .from('cash_sessions')
        .update({
          status:                'closed',
          closing_cash_counted:  input.closing_cash_counted,
          closing_knet_terminal: input.closing_knet_terminal,
          closing_card_terminal: input.closing_card_terminal,
          closing_notes:         input.closing_notes || null,
          closed_by:             user?.id,
          closed_at:             new Date().toISOString(),
          // Snapshot live totals at close time
          total_cash_sales:      totals.cashSales,
          total_knet_sales:      totals.knetSales,
          total_card_sales:      totals.cardSales,
          total_gift_sales:      totals.giftSales,
          total_cash_payouts:    totalPayouts,
          total_refunds:         totals.refunds,
          transaction_count:     totals.txnCount,
          cash_variance:         variance,
          updated_at:            new Date().toISOString(),
        })
        .eq('id', input.session_id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, expectedCash, totals, totalPayouts };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session-today'] });
      queryClient.invalidateQueries({ queryKey: ['cash-sessions-history'] });
      toast({ title: '🔴 Day closed', description: 'Cash drawer session has been locked.' });
    },
    onError: (e: any) => toast({ title: 'Cannot close day', description: e.message, variant: 'destructive' }),
  });
}

/** Record a cash payout from the till */
export function useAddPayout() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      amount: number;
      reason: string;
      paid_to?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('session_payouts')
        .insert({
          session_id: input.session_id,
          tenant_id:  tenant!.id,
          amount:     input.amount,
          reason:     input.reason,
          paid_to:    input.paid_to || null,
          paid_by:    user?.id,
          payout_at:  new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session-today'] });
      toast({ title: 'Payout recorded' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}
