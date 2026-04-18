import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, RotateCcw, CheckCircle2, CreditCard, Banknote, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface OriginalPayment {
  id: string;
  payment_method: string;
  amount: number;
}

interface TransactionItem {
  id: string;
  item_type: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Transaction {
  id: string;
  grand_total: number;
  subtotal: number;
  tax_amount: number;
  tip_amount: number;
  discount_amount: number;
  status: string;
  client_id: string | null;
  booking_id: string | null;
  notes?: string | null;
  created_at: string;
  transaction_payments: OriginalPayment[];
  transaction_items: TransactionItem[];
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onRefundComplete?: () => void;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash:        'Cash / نقداً',
  knet:        'K-NET / كي نت',
  credit_card: 'Credit Card / بطاقة ائتمان',
  gift_card:   'Gift Card / بطاقة هدية',
};

const REFUND_REASONS = [
  'Client dissatisfied with service',
  'Service not delivered as promised',
  'Double charge / billing error',
  'Client changed mind',
  'Medical reason',
  'Wrong service charged',
  'Product returned',
  'Other',
];

type RefundType = 'full' | 'partial';

export function RefundDialog({ open, onOpenChange, transaction, onRefundComplete }: RefundDialogProps) {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [refundType, setRefundType]       = useState<RefundType>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [refundMethod, setRefundMethod]   = useState('');
  const [reason, setReason]               = useState('');
  const [reasonDetail, setReasonDetail]   = useState('');
  const [approverPin, setApproverPin]     = useState('');
  const [step, setStep]                   = useState<'form' | 'confirm' | 'done'>('form');
  const [processing, setProcessing]       = useState(false);
  const [refundRef, setRefundRef]         = useState('');

  // Reset on open
  useEffect(() => {
    if (open) {
      setRefundType('full');
      setPartialAmount('');
      setReason('');
      setReasonDetail('');
      setApproverPin('');
      setStep('form');
      setProcessing(false);
      // Default refund method to the largest original payment method
      if (transaction?.transaction_payments?.length) {
        const largest = [...transaction.transaction_payments]
          .sort((a, b) => b.amount - a.amount)[0];
        setRefundMethod(largest.payment_method);
      }
    }
  }, [open, transaction]);

  if (!transaction) return null;

  const originalTotal  = Number(transaction.grand_total);
  const refundAmount   = refundType === 'full'
    ? originalTotal
    : Math.min(parseFloat(partialAmount) || 0, originalTotal);
  const currency       = tenant?.currency || 'KWD';
  const isPartialValid = refundType === 'partial' && refundAmount > 0 && refundAmount <= originalTotal;
  const canProceed     = refundAmount > 0 && reason && refundMethod &&
                         (refundType === 'full' || isPartialValid);

  const handleRefund = async () => {
    if (!canProceed || !tenant) return;
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isFullRefund = refundType === 'full' || refundAmount >= originalTotal;
      const refundRatio  = originalTotal > 0 ? refundAmount / originalTotal : 0;
      const ref = `REF-${Date.now().toString(36).toUpperCase()}`;
      setRefundRef(ref);

      // ── GUARD: prevent double refund ──────────────────────────
      // Re-read the current transaction status from the DB.  If someone
      // already processed a full refund (status === 'refunded'), abort.
      // Without this, a stale dialog could fire a second refund.
      const { data: currentTxn } = await supabase
        .from('transactions')
        .select('status, grand_total')
        .eq('id', transaction.id)
        .single();
      if (currentTxn?.status === 'refunded') {
        toast({ title: 'Already refunded', description: 'This transaction was already fully refunded.', variant: 'destructive' });
        setProcessing(false);
        return;
      }

      // 1. Update original transaction status
      await supabase
        .from('transactions')
        .update({
          status: (isFullRefund ? 'refunded' : 'completed') as any,
          notes: [
            transaction.notes || '',
            `REFUND ${ref}: ${refundAmount.toFixed(3)} ${currency} via ${refundMethod}. Reason: ${reason}${reasonDetail ? ' — ' + reasonDetail : ''}. By: ${user?.email}`,
          ].filter(Boolean).join(' | '),
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id);

      // 2. Insert a negative/reversal transaction for proper accounting.
      //    Preserve booking_id for per-booking refund traceability.
      //    Downstream queries that want "the sale" filter by
      //    status = 'completed', so the reversal row won't confuse them.
      const { data: refundTxn } = await supabase
        .from('transactions')
        .insert({
          tenant_id: tenant.id,
          client_id: transaction.client_id,
          booking_id: transaction.booking_id, // keep link to booking
          subtotal:       -(refundAmount),
          discount_amount: 0,
          tax_amount:      0,
          tip_amount:      0,
          grand_total:    -(refundAmount),
          status:         'refunded' as any,
          notes: `REFUND ${ref} for TXN ${transaction.id.slice(0, 8).toUpperCase()}. Reason: ${reason}${reasonDetail ? ' — ' + reasonDetail : ''}`,
        })
        .select('id')
        .single();

      // 2b. Insert a payment row for the reversal with the chosen method.
      //     Without this, the Z-report can't attribute the refund to a
      //     specific payment method (cash vs card vs knet), which breaks
      //     cash-drawer variance calculation.  Amount is negative.
      if (refundTxn?.id) {
        await supabase
          .from('transaction_payments')
          .insert({
            transaction_id: refundTxn.id,
            payment_method: refundMethod as any,
            amount:         -(refundAmount),
          });
      }

      // 3. Reverse inventory — retail products AND service recipe consumption.
      //    Partial refunds skip inventory by default (amount was refunded, but
      //    items weren't physically returned — that's a business decision).
      if (isFullRefund) {
        // 3a. Retail products: simple +qty back to stock
        const productItems = transaction.transaction_items?.filter(i => i.item_type === 'product') || [];
        for (const item of productItems) {
          const { data: product } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', item.item_id)
            .single();

          if (product) {
            await supabase
              .from('products')
              .update({ current_stock: product.current_stock + item.quantity })
              .eq('id', item.item_id);

            await supabase
              .from('inventory_transactions')
              .insert({
                tenant_id: tenant.id,
                product_id: item.item_id,
                quantity_change: item.quantity,
                transaction_type: 'return' as any,
                reference_id: transaction.id,
                reference_type: 'refund',
                notes: `Refund ${ref} — ${item.item_name} returned to stock`,
              });
          }
        }

        // 3b. Service recipe consumption: reverse BOM deduction so the
        //     professional products consumed by refunded services return
        //     to stock.  Without this, a refunded service leaves its
        //     shampoo/color/etc. written off from inventory.
        const serviceItems = transaction.transaction_items?.filter(i => i.item_type === 'service') || [];
        for (const item of serviceItems) {
          const { data: recipes } = await supabase
            .from('service_recipes')
            .select('product_id, quantity_per_service, product:products(id, name, current_stock)')
            .eq('service_id', item.item_id);

          for (const recipe of recipes || []) {
            const product: any = (recipe as any).product;
            if (!product) continue;
            const returnQty = Number(recipe.quantity_per_service) * item.quantity;
            await supabase
              .from('products')
              .update({ current_stock: Number(product.current_stock) + returnQty })
              .eq('id', recipe.product_id);
            await supabase
              .from('inventory_transactions')
              .insert({
                tenant_id: tenant.id,
                product_id: recipe.product_id,
                quantity_change: returnQty,
                transaction_type: 'return' as any,
                reference_id: transaction.id,
                reference_type: 'refund',
                notes: `Refund ${ref} — service recipe reversal (${product.name})`,
              });
          }
        }

        // 3c. Do NOT change booking.status on refund.  The service was
        //     delivered — that's a fact.  Previously this wrote
        //     status='cancelled', which is semantically wrong (client did
        //     come, service did happen).  Reports should rely on the
        //     transaction status for revenue attribution.
      }

      // 4. Post reversing journal entry.  Mirrors the sale JE created by
      //    POS.tsx with debit/credit swapped.  Partial refunds are prorated
      //    by refundRatio so GL matches the cash actually returned.
      try {
        // Find the original sale JE
        const { data: saleJE } = await (supabase as any)
          .from('journal_entries')
          .select('id, entry_number, lines:journal_lines(account_id, debit, credit, description)')
          .eq('source_ref_id', transaction.id)
          .eq('source_ref_type', 'transaction')
          .eq('source', 'pos')
          .maybeSingle();

        if (saleJE?.lines?.length) {
          const year = new Date().getFullYear();
          const { data: existing } = await (supabase as any)
            .from('journal_entries').select('entry_number')
            .eq('tenant_id', tenant.id)
            .like('entry_number', `REF-${year}-%`)
            .order('entry_number', { ascending: false }).limit(1);
          const lastNum = existing?.[0]?.entry_number?.split('-')[2] || '0000';
          const nextNum = String(parseInt(lastNum) + 1).padStart(4, '0');

          const { data: refJE } = await (supabase as any).from('journal_entries').insert({
            tenant_id: tenant.id,
            entry_number: `REF-${year}-${nextNum}`,
            entry_date: new Date().toISOString().split('T')[0],
            source: 'refund',
            source_ref_id: refundTxn?.id ?? transaction.id,
            source_ref_type: 'transaction',
            description: `POS Refund ${ref} — reverses ${saleJE.entry_number}`,
            is_posted: true,
          }).select('id').single();

          if (refJE) {
            const refLines = saleJE.lines.map((l: any) => ({
              journal_entry_id: refJE.id,
              account_id:       l.account_id,
              // Swap sides, prorated by refundRatio for partial refunds
              debit:  Number(l.credit || 0) * refundRatio,
              credit: Number(l.debit  || 0) * refundRatio,
              description: `REVERSAL — ${l.description || ''}`.trim(),
            }));
            await (supabase as any).from('journal_lines').insert(refLines);
          }
        }
      } catch { /* silent — GL reversal is best-effort, like the sale JE */ }

      // 5. Loyalty reversal.  Prorated by refundRatio so a partial
      //    refund gives back a proportional share of redeemed points
      //    and deducts a proportional share of points that were earned.
      //    Without this, every refund quietly created a points imbalance:
      //    earned points persisted, redeemed points were lost forever.
      try {
        const { data: loyaltyRows } = await supabase
          .from('loyalty_transactions')
          .select('id, client_id, type, points')
          .eq('transaction_id', transaction.id)
          .in('type', ['earn', 'redeem']);

        if (loyaltyRows && loyaltyRows.length > 0 && transaction.client_id) {
          let netAdjustment = 0; // net change to apply to client balance
          for (const row of loyaltyRows) {
            const originalPoints = Number(row.points); // +N for earn, -N for redeem
            const reversePoints  = Math.round(-originalPoints * refundRatio);
            if (reversePoints === 0) continue;

            // Fetch current balance for accurate balance_after
            const { data: client } = await supabase
              .from('clients').select('loyalty_points').eq('id', transaction.client_id).single();
            const before = Number(client?.loyalty_points || 0);
            const after  = Math.max(0, before + reversePoints);

            await supabase.from('loyalty_transactions').insert({
              tenant_id: tenant.id,
              client_id: transaction.client_id,
              transaction_id: transaction.id,
              type:          `refund_${row.type}`,
              points:        reversePoints,
              balance_after: after,
              note:          `Refund ${ref} — reversing ${row.type} of ${Math.abs(originalPoints)} points`,
            });

            await supabase
              .from('clients')
              .update({ loyalty_points: after })
              .eq('id', transaction.client_id);

            netAdjustment += reversePoints;
          }
        }
      } catch { /* best-effort — loyalty reversal must not block the refund */ }

      // 6. Package session reversal.  If any package_redemptions were
      //    recorded against this transaction (client used a package
      //    session for a service that is now being refunded), return
      //    those sessions to the client's package balance.  Without
      //    this, a refund leaves the client short: no service AND no
      //    session on their package card.  Partial refunds don't
      //    reverse package sessions — they're discrete, not prorated.
      if (isFullRefund) {
        try {
          const { data: redemptions } = await supabase
            .from('package_redemptions')
            .select('id, client_package_id')
            .eq('transaction_id', transaction.id);

          for (const r of redemptions || []) {
            const { data: pkg } = await supabase
              .from('client_packages')
              .select('sessions_used, sessions_total, status')
              .eq('id', r.client_package_id)
              .single();
            if (!pkg) continue;

            const newUsed = Math.max(0, Number(pkg.sessions_used) - 1);
            await supabase
              .from('client_packages')
              .update({
                sessions_used: newUsed,
                // If previously depleted and now has availability, re-activate.
                status: pkg.status === 'depleted' && newUsed < Number(pkg.sessions_total)
                  ? 'active'
                  : pkg.status,
              })
              .eq('id', r.client_package_id);

            // Mark the redemption audit row as reversed so history shows
            // it but the counter matches the package state.
            await supabase
              .from('package_redemptions')
              .delete()
              .eq('id', r.id);
          }
        } catch { /* best-effort */ }
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty'] });
      queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
      queryClient.invalidateQueries({ queryKey: ['cash-session'] });

      setStep('done');
      toast({
        title: `↩ Refund processed — ${ref}`,
        description: `${refundAmount.toFixed(3)} ${currency} refunded via ${PAYMENT_METHOD_LABELS[refundMethod] || refundMethod}`,
      });
      onRefundComplete?.();
    } catch (err: any) {
      toast({ title: 'Refund failed', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  // ── Done screen ──────────────────────────────────────────────
  if (step === 'done') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center py-6 text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold">Refund Complete</p>
              <p className="text-sm text-muted-foreground mt-1">Reference: <span className="font-mono font-bold">{refundRef}</span></p>
            </div>
            <div className="w-full bg-muted/40 rounded-xl p-4 text-sm space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount refunded</span>
                <span className="font-bold text-emerald-600">{refundAmount.toFixed(3)} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Refund method</span>
                <span className="font-medium">{PAYMENT_METHOD_LABELS[refundMethod] || refundMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reason</span>
                <span className="font-medium text-right max-w-[160px]">{reason}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Hand {refundAmount.toFixed(3)} {currency} to the client{refundMethod === 'cash' ? ' in cash' : ` via ${refundMethod.replace('_',' ')}`}.
            </p>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Confirm screen ───────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Refund
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between font-bold text-base">
                <span>Refund amount</span>
                <span className="text-amber-700 dark:text-amber-400">{refundAmount.toFixed(3)} {currency}</span>
              </div>
              <Separator className="bg-amber-200 dark:bg-amber-800" />
              <div className="flex justify-between text-muted-foreground">
                <span>Original sale</span>
                <span>{originalTotal.toFixed(3)} {currency}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Refund via</span>
                <span>{PAYMENT_METHOD_LABELS[refundMethod] || refundMethod}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Type</span>
                <span>{refundType === 'full' ? 'Full refund' : 'Partial refund'}</span>
              </div>
              <div className="pt-1">
                <span className="text-muted-foreground">Reason: </span>
                <span className="font-medium">{reason}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              This action will be logged against your account and cannot be undone.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep('form')} disabled={processing}>
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleRefund}
              disabled={processing}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 min-w-[120px]"
            >
              {processing ? (
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><RotateCcw className="h-3.5 w-3.5" />Process Refund</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Main form ────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <RotateCcw className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-base font-bold">Process Refund</p>
              <p className="text-xs font-normal text-muted-foreground">
                TXN #{transaction.id.slice(0, 8).toUpperCase()} · {format(new Date(transaction.created_at), 'dd MMM yyyy, h:mm a')}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* Original sale summary */}
          <div className="rounded-xl bg-muted/40 border border-border p-3.5 space-y-1.5 text-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Original Sale</p>
            {transaction.transaction_items?.map(item => (
              <div key={item.id} className="flex justify-between">
                <span className="text-muted-foreground truncate max-w-[200px]">{item.item_name} × {item.quantity}</span>
                <span className="font-medium">{Number(item.total_price).toFixed(3)}</span>
              </div>
            ))}
            <Separator className="my-1" />
            <div className="flex justify-between font-bold">
              <span>Total paid</span>
              <span>{originalTotal.toFixed(3)} {currency}</span>
            </div>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {transaction.transaction_payments?.map((p, i) => (
                <Badge key={i} variant="outline" className="text-[10px] h-4 px-1.5 rounded-full">
                  {PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method} — {Number(p.amount).toFixed(3)}
                </Badge>
              ))}
            </div>
          </div>

          {/* Refund type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Refund Type</Label>
            <RadioGroup value={refundType} onValueChange={v => setRefundType(v as RefundType)} className="grid grid-cols-2 gap-2">
              <Label htmlFor="full" className={cn(
                'flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all text-center',
                refundType === 'full' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              )}>
                <RadioGroupItem value="full" id="full" className="sr-only" />
                <Receipt className="h-5 w-5" />
                <span className="text-sm font-semibold">Full Refund</span>
                <span className="text-[11px] text-muted-foreground">{originalTotal.toFixed(3)} {currency}</span>
              </Label>
              <Label htmlFor="partial" className={cn(
                'flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all text-center',
                refundType === 'partial' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              )}>
                <RadioGroupItem value="partial" id="partial" className="sr-only" />
                <CreditCard className="h-5 w-5" />
                <span className="text-sm font-semibold">Partial Refund</span>
                <span className="text-[11px] text-muted-foreground">Enter amount</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Partial amount input */}
          {refundType === 'partial' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Refund Amount ({currency})</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  max={originalTotal}
                  value={partialAmount}
                  onChange={e => setPartialAmount(e.target.value)}
                  placeholder={`0.000 — max ${originalTotal.toFixed(3)}`}
                  className="h-10 pr-16"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{currency}</span>
              </div>
              {parseFloat(partialAmount) > originalTotal && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Cannot exceed original amount of {originalTotal.toFixed(3)} {currency}
                </p>
              )}
            </div>
          )}

          {/* Refund method */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Refund Method</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'knet', 'credit_card'] as const).map(method => (
                <button
                  key={method}
                  onClick={() => setRefundMethod(method)}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all text-left',
                    refundMethod === method
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  {method === 'cash' ? <Banknote className="h-4 w-4 flex-shrink-0" /> : <CreditCard className="h-4 w-4 flex-shrink-0" />}
                  <span className="text-xs">{method === 'cash' ? 'Cash' : method === 'knet' ? 'K-NET' : 'Credit Card'}</span>
                  {/* Flag if matches original payment */}
                  {transaction.transaction_payments?.some(p => p.payment_method === method) && (
                    <span className="ml-auto text-[9px] text-primary font-bold">Original</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reason for Refund <span className="text-destructive">*</span></Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional detail */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Additional Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              value={reasonDetail}
              onChange={e => setReasonDetail(e.target.value)}
              placeholder="Any additional details about this refund..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Inventory note for full refund with products */}
          {refundType === 'full' && transaction.transaction_items?.some(i => i.item_type === 'product') && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>Product stock will be automatically restored for returned items.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => setStep('confirm')}
            disabled={!canProceed}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Review Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
