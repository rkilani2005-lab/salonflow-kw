import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { PaymentEntry, CartItem } from '@/hooks/useTransactions';
import {
  Banknote, CreditCard, Smartphone, Gift, Trash2, Loader2, Check,
  Users, ChevronRight, ArrowLeft,
} from 'lucide-react';

const EPS = 0.001;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

type PaymentMethod = PaymentEntry['payment_method'];

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grandTotal: number;
  onConfirm: (payments: PaymentEntry[], tipSplits?: { staff_id: string; amount: number }[]) => void;
  loading?: boolean;
  maxByMethod?: Partial<Record<PaymentMethod, number>>;
  currency?: string;
  tipAmount?: number;
  items?: CartItem[];
}

const PAYMENT_METHODS: { method: PaymentMethod; label: string; icon: React.ElementType; color: string }[] = [
  { method: 'cash',        label: 'Cash',        icon: Banknote,   color: 'border-green-500 bg-green-500/10 text-green-700 hover:bg-green-500/20' },
  { method: 'knet',        label: 'K-NET',       icon: Smartphone, color: 'border-blue-500 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20' },
  { method: 'credit_card', label: 'Credit Card', icon: CreditCard, color: 'border-purple-500 bg-purple-500/10 text-purple-700 hover:bg-purple-500/20' },
  { method: 'gift_card',   label: 'Gift Card',   icon: Gift,       color: 'border-amber-500 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20' },
];

function splitShares(total: number, n: number): number[] {
  if (n <= 1) return [round3(total)];
  const base = round3(total / n);
  const shares = Array(n).fill(base);
  const distributed = round3(base * n);
  shares[n - 1] = round3(shares[n - 1] + (total - distributed));
  return shares;
}

interface CompletedPayer {
  index: number;
  label: string;
  share: number;
  payments: PaymentEntry[];
}

export function PaymentDialog({
  open, onOpenChange, grandTotal, onConfirm, loading,
  maxByMethod = {},
  currency = 'KWD',
  tipAmount = 0,
  items = [],
}: PaymentDialogProps) {

  const [splitCount, setSplitCount] = useState(1);
  const [payerIndex, setPayerIndex] = useState(0);
  const [completedPayers, setCompletedPayers] = useState<CompletedPayer[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [payerLabel, setPayerLabel] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [tipSplits, setTipSplits] = useState<{ staff_id: string; amount: number }[]>([]);

  useEffect(() => {
    if (!open) {
      setSplitCount(1);
      setPayerIndex(0);
      setCompletedPayers([]);
      setPayments([]);
      setPayerLabel('');
      setCustomAmount('');
      setTipSplits([]);
    }
  }, [open]);

  const shares = useMemo(() => splitShares(grandTotal, splitCount), [grandTotal, splitCount]);
  const currentShare = shares[payerIndex] ?? grandTotal;
  const splitMode = splitCount > 1;

  const totalPaid = round3(payments.reduce((sum, p) => sum + p.amount, 0));
  const remaining = round3(currentShare - totalPaid);

  const addedByMethod: Partial<Record<PaymentMethod, number>> = {};
  for (const p of payments) {
    addedByMethod[p.payment_method] = round3((addedByMethod[p.payment_method] ?? 0) + p.amount);
  }

  const addPayment = (method: PaymentMethod) => {
    const requested = customAmount ? parseFloat(customAmount) : remaining;
    if (!isFinite(requested) || requested <= 0) return;

    const methodCapRaw = maxByMethod[method];
    const alreadyAdded = addedByMethod[method] ?? 0;
    const methodRemainingCap =
      methodCapRaw !== undefined ? Math.max(0, round3(methodCapRaw - alreadyAdded)) : undefined;

    let finalAmount: number;
    if (method === 'cash') {
      finalAmount = round3(requested);
      if (methodRemainingCap !== undefined && finalAmount > methodRemainingCap + EPS) {
        finalAmount = methodRemainingCap;
      }
    } else {
      if (requested > remaining + EPS) return;
      finalAmount = Math.min(round3(requested), remaining);
      if (methodRemainingCap !== undefined) finalAmount = Math.min(finalAmount, methodRemainingCap);
      if (finalAmount <= 0) return;
    }

    setPayments([...payments, { payment_method: method, amount: round3(finalAmount) }]);
    setCustomAmount('');
  };

  const removePayment = (i: number) => setPayments(payments.filter((_, idx) => idx !== i));

  const cashPaid = round3(payments.filter(p => p.payment_method === 'cash').reduce((s, p) => s + p.amount, 0));
  const nonCashPaid = round3(totalPaid - cashPaid);
  const cashNeeded = Math.max(0, round3(currentShare - nonCashPaid));
  const changeDue = Math.max(0, round3(cashPaid - cashNeeded));

  const canAdvance = round3(nonCashPaid + Math.min(cashPaid, cashNeeded)) >= round3(currentShare) - EPS;
  const isLastPayer = payerIndex === splitCount - 1;

  const handleAdvance = () => {
    if (!canAdvance) return;
    const label = payerLabel.trim() || `Payer ${payerIndex + 1}`;
    const thisEntry: CompletedPayer = {
      index: payerIndex + 1,
      label,
      share: currentShare,
      payments: [...payments],
    };
    const updated = [...completedPayers, thisEntry];

    if (isLastPayer) {
      const flat: PaymentEntry[] = splitMode
        ? updated.flatMap(p => p.payments.map(pay => ({
            ...pay,
            payer_index: p.index,
            payer_label: p.label,
          })))
        : updated.flatMap(p => p.payments);
      onConfirm(flat);
    } else {
      setCompletedPayers(updated);
      setPayerIndex(p => p + 1);
      setPayments([]);
      setPayerLabel('');
      setCustomAmount('');
    }
  };

  const handleBack = () => {
    if (payerIndex === 0) return;
    setPayerIndex(p => p - 1);
    const prev = completedPayers[completedPayers.length - 1];
    setPayments(prev.payments);
    setPayerLabel(prev.label.startsWith('Payer ') ? '' : prev.label);
    setCompletedPayers(completedPayers.slice(0, -1));
  };

  const isMethodDisabled = (method: PaymentMethod): { disabled: boolean; label?: string } => {
    const cap = maxByMethod[method];
    if (cap !== undefined && cap <= 0) {
      if (method === 'gift_card') return { disabled: true, label: 'No gift card linked' };
      return { disabled: true, label: 'Unavailable' };
    }
    const alreadyAdded = addedByMethod[method] ?? 0;
    if (cap !== undefined && alreadyAdded >= cap - EPS) {
      return { disabled: true, label: 'Max reached' };
    }
    if (method !== 'cash' && remaining <= EPS) return { disabled: true };
    return { disabled: false };
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Payment
            {splitMode && (
              <Badge variant="secondary" className="font-normal">
                <Users className="h-3 w-3 mr-1" />
                Payer {payerIndex + 1} of {splitCount}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {splitMode ? (
              <>This payer owes: <strong>{currentShare.toFixed(3)} {currency}</strong> · Sale total: {grandTotal.toFixed(3)} {currency}</>
            ) : (
              <>Total: <strong>{grandTotal.toFixed(3)} {currency}</strong></>
            )}
          </DialogDescription>
        </DialogHeader>

        {!splitMode && payments.length === 0 && completedPayers.length === 0 && (
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> SPLIT BILL ACROSS PAYERS
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {[2, 3, 4, 5, 6].map(n => (
                <Button
                  key={n}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs flex-1 min-w-[44px]"
                  onClick={() => { setSplitCount(n); }}
                >
                  {n} ways
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Total splits equally. Each payer pays their share with their own method(s).
            </p>
          </div>
        )}

        {splitMode && payerIndex === 0 && payments.length === 0 && completedPayers.length === 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start -ml-2 w-fit"
            onClick={() => { setSplitCount(1); }}>
            <ArrowLeft className="h-3 w-3 mr-1" /> Back to single payer
          </Button>
        )}

        <div className="space-y-4">
          {splitMode && (
            <Input
              value={payerLabel}
              onChange={e => setPayerLabel(e.target.value)}
              placeholder={`Payer ${payerIndex + 1} name (optional)`}
              className="h-9 text-sm"
              maxLength={40}
            />
          )}

          <div className={cn(
            'text-center p-4 rounded-lg border-2',
            remaining <= EPS ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-border bg-muted/50'
          )}>
            <p className="text-sm text-muted-foreground">{splitMode ? "Payer's Remaining" : 'Remaining Balance'}</p>
            <p className={cn('text-3xl font-bold', remaining <= EPS ? 'text-green-600' : 'text-foreground')}>
              {(remaining <= EPS ? 0 : remaining).toFixed(3)} {currency}
            </p>
          </div>

          {changeDue > EPS && (
            <div className="text-center p-3 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Change to return
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {changeDue.toFixed(3)} {currency}
              </p>
            </div>
          )}

          {remaining > EPS && (
            <div className="space-y-2">
              <Input
                type="number"
                placeholder={`Amount (default: ${remaining.toFixed(3)})`}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="h-12 text-lg text-center"
                min="0"
                step="0.001"
              />
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map(({ method, label, icon: Icon, color }) => {
                  const { disabled, label: disabledLabel } = isMethodDisabled(method);
                  return (
                    <Button
                      key={method}
                      variant="outline"
                      className={cn('h-16 text-base font-medium border-2 flex flex-col gap-0.5', color, disabled && 'opacity-50')}
                      onClick={() => addPayment(method)}
                      disabled={disabled}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{label}</span>
                      {disabledLabel && <span className="text-[10px] font-normal opacity-70">{disabledLabel}</span>}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {payments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {splitMode ? `${payerLabel || `Payer ${payerIndex + 1}`}'s payments` : 'Payment Split'}
                </p>
                {payments.map((p, i) => {
                  const methodInfo = PAYMENT_METHODS.find(m => m.method === p.payment_method);
                  return (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{methodInfo?.label || p.payment_method}</Badge>
                        <span className="font-medium">{p.amount.toFixed(3)} {currency}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => removePayment(i)} disabled={loading}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {splitMode && completedPayers.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Already paid
                </p>
                {completedPayers.map((e) => (
                  <div key={e.index} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/30">
                    <span className="truncate mr-2">{e.label} · {e.payments.map(p => p.payment_method).join(' + ')}</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                      ✓ {e.share.toFixed(3)} {currency}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex gap-2">
            {splitMode && payerIndex > 0 && (
              <Button variant="outline" onClick={handleBack} disabled={loading} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            <Button
              onClick={handleAdvance}
              className="flex-1 h-14 text-lg font-semibold"
              disabled={!canAdvance || loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
              ) : isLastPayer ? (
                <><Check className="mr-2 h-5 w-5" /> Complete Sale</>
              ) : (
                <>Next Payer <ChevronRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
