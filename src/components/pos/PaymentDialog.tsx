import { useState } from 'react';
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
import type { PaymentEntry } from '@/hooks/useTransactions';
import { Banknote, CreditCard, Smartphone, Gift, Trash2, Loader2, Check } from 'lucide-react';

// Money-math tolerance — one-tenth of a fil (KWD uses 3 decimal places).
// All comparisons throughout this dialog use this same epsilon to avoid
// silent off-by-one-fil gaps that previously let sales close with up to
// 10 fils short of the grand total (the old code mixed 0.01 and 0.001).
const EPS = 0.001;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

type PaymentMethod = PaymentEntry['payment_method'];

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grandTotal: number;
  onConfirm: (payments: PaymentEntry[]) => void;
  loading?: boolean;
  /**
   * Per-method caps, in currency units.  If a method has a cap of 0 the
   * button is disabled with an explanatory label — used to prevent a
   * gift-card payment from being added when no gift card has been
   * validated yet (previous code let you record a gift-card payment
   * with no backing card, draining nothing while crediting the sale).
   * Cash and cards have no cap unless the caller sets one.
   */
  maxByMethod?: Partial<Record<PaymentMethod, number>>;
  /** ISO-ish currency code for display (KWD, USD, AED, …). */
  currency?: string;
}

const PAYMENT_METHODS: { method: PaymentMethod; label: string; icon: React.ElementType; color: string }[] = [
  { method: 'cash',        label: 'Cash',        icon: Banknote,   color: 'border-green-500 bg-green-500/10 text-green-700 hover:bg-green-500/20' },
  { method: 'knet',        label: 'K-NET',       icon: Smartphone, color: 'border-blue-500 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20' },
  { method: 'credit_card', label: 'Credit Card', icon: CreditCard, color: 'border-purple-500 bg-purple-500/10 text-purple-700 hover:bg-purple-500/20' },
  { method: 'gift_card',   label: 'Gift Card',   icon: Gift,       color: 'border-amber-500 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20' },
];

export function PaymentDialog({
  open, onOpenChange, grandTotal, onConfirm, loading,
  maxByMethod = {},
  currency = 'KWD',
}: PaymentDialogProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [customAmount, setCustomAmount] = useState('');

  const totalPaid = round3(payments.reduce((sum, p) => sum + p.amount, 0));
  const remaining = round3(grandTotal - totalPaid);

  // How much of each method has already been added?  Used to enforce
  // per-method caps across multiple split entries.
  const addedByMethod: Partial<Record<PaymentMethod, number>> = {};
  for (const p of payments) {
    addedByMethod[p.payment_method] = round3((addedByMethod[p.payment_method] ?? 0) + p.amount);
  }

  const addPayment = (method: PaymentMethod) => {
    // Cash is the only method that may exceed `remaining` — the overshoot
    // becomes change returned to the customer.  Everything else (card,
    // knet, gift_card) must match remaining exactly or be below it.
    const requested = customAmount ? parseFloat(customAmount) : remaining;
    if (!isFinite(requested) || requested <= 0) return;

    // Per-method cap (e.g. gift card balance).  Undefined = no cap.
    const methodCapRaw = maxByMethod[method];
    const alreadyAdded = addedByMethod[method] ?? 0;
    const methodRemainingCap =
      methodCapRaw !== undefined ? Math.max(0, round3(methodCapRaw - alreadyAdded)) : undefined;

    let finalAmount: number;
    if (method === 'cash') {
      // Allow overpay — change will be shown below.
      finalAmount = round3(requested);
      if (methodRemainingCap !== undefined && finalAmount > methodRemainingCap + EPS) {
        finalAmount = methodRemainingCap;
      }
    } else {
      // Non-cash: clamp to min(remaining, method cap).
      if (requested > remaining + EPS) return;
      finalAmount = Math.min(round3(requested), remaining);
      if (methodRemainingCap !== undefined) {
        finalAmount = Math.min(finalAmount, methodRemainingCap);
      }
      if (finalAmount <= 0) return;
    }

    setPayments([...payments, { payment_method: method, amount: round3(finalAmount) }]);
    setCustomAmount('');
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  // Cash is the only method that may overpay.  `cashPaid - cashNeeded`
  // is change due to the customer.
  const cashPaid  = round3(payments.filter(p => p.payment_method === 'cash').reduce((s, p) => s + p.amount, 0));
  const nonCashPaid = round3(totalPaid - cashPaid);
  const cashNeeded = Math.max(0, round3(grandTotal - nonCashPaid));
  const changeDue  = Math.max(0, round3(cashPaid - cashNeeded));

  // Sale closes when non-cash portion plus minimum-needed cash exactly
  // covers the grand total, within one fil of tolerance.
  const canConfirm = round3(nonCashPaid + Math.min(cashPaid, cashNeeded)) >= round3(grandTotal) - EPS;

  const handleConfirm = () => {
    if (canConfirm) onConfirm(payments);
  };

  const handleReset = () => {
    setPayments([]);
    setCustomAmount('');
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
    // Non-cash methods disable when nothing left owed.
    if (method !== 'cash' && remaining <= EPS) return { disabled: true };
    return { disabled: false };
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) { onOpenChange(o); handleReset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
          <DialogDescription>
            Total: <strong>{grandTotal.toFixed(3)} {currency}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Remaining balance */}
          <div className={cn(
            'text-center p-4 rounded-lg border-2',
            remaining <= EPS ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-border bg-muted/50'
          )}>
            <p className="text-sm text-muted-foreground">Remaining Balance</p>
            <p className={cn('text-3xl font-bold', remaining <= EPS ? 'text-green-600' : 'text-foreground')}>
              {(remaining <= EPS ? 0 : remaining).toFixed(3)} {currency}
            </p>
          </div>

          {/* Change due (cash overpay) */}
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

          {/* Amount + method buttons (shown while there is balance, or to allow cash overpay) */}
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

          {/* Added payments */}
          {payments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Payment Split</p>
                {payments.map((p, i) => {
                  const methodInfo = PAYMENT_METHODS.find(m => m.method === p.payment_method);
                  return (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{methodInfo?.label || p.payment_method}</Badge>
                        <span className="font-medium">{p.amount.toFixed(3)} {currency}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removePayment(i)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Confirm button */}
          <Button
            onClick={handleConfirm}
            className="w-full h-14 text-lg font-semibold"
            disabled={!canConfirm || loading}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
            ) : (
              <><Check className="mr-2 h-5 w-5" /> Complete Sale</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
