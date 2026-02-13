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

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grandTotal: number;
  onConfirm: (payments: PaymentEntry[]) => void;
  loading?: boolean;
}

const PAYMENT_METHODS: { method: PaymentEntry['payment_method']; label: string; icon: React.ElementType; color: string }[] = [
  { method: 'cash', label: 'Cash', icon: Banknote, color: 'border-green-500 bg-green-500/10 text-green-700 hover:bg-green-500/20' },
  { method: 'knet', label: 'K-NET', icon: Smartphone, color: 'border-blue-500 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20' },
  { method: 'credit_card', label: 'Credit Card', icon: CreditCard, color: 'border-purple-500 bg-purple-500/10 text-purple-700 hover:bg-purple-500/20' },
  { method: 'gift_card', label: 'Gift Card', icon: Gift, color: 'border-amber-500 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20' },
];

export function PaymentDialog({ open, onOpenChange, grandTotal, onConfirm, loading }: PaymentDialogProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [customAmount, setCustomAmount] = useState('');

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.round((grandTotal - totalPaid) * 1000) / 1000;

  const addPayment = (method: PaymentEntry['payment_method']) => {
    const amount = customAmount ? parseFloat(customAmount) : remaining;
    if (amount <= 0 || amount > remaining + 0.001) return;

    const finalAmount = Math.min(amount, remaining);
    setPayments([...payments, { payment_method: method, amount: Math.round(finalAmount * 1000) / 1000 }]);
    setCustomAmount('');
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (Math.abs(remaining) < 0.01) {
      onConfirm(payments);
    }
  };

  const handleReset = () => {
    setPayments([]);
    setCustomAmount('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) { onOpenChange(o); handleReset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
          <DialogDescription>
            Total: <strong>{grandTotal.toFixed(3)} KWD</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Remaining balance */}
          <div className={cn(
            'text-center p-4 rounded-lg border-2',
            remaining <= 0 ? 'border-green-500 bg-green-50' : 'border-border bg-muted/50'
          )}>
            <p className="text-sm text-muted-foreground">Remaining Balance</p>
            <p className={cn('text-3xl font-bold', remaining <= 0 ? 'text-green-600' : 'text-foreground')}>
              {remaining <= 0 ? '0.000' : remaining.toFixed(3)} KWD
            </p>
          </div>

          {/* Custom amount input */}
          {remaining > 0 && (
            <div className="space-y-2">
              <Input
                type="number"
                placeholder={`Amount (default: ${remaining.toFixed(3)})`}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="h-12 text-lg text-center"
                min="0"
                max={remaining}
                step="0.001"
              />
              {/* Payment method buttons */}
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map(({ method, label, icon: Icon, color }) => (
                  <Button
                    key={method}
                    variant="outline"
                    className={cn('h-16 text-base font-medium border-2 flex flex-col gap-1', color)}
                    onClick={() => addPayment(method)}
                    disabled={remaining <= 0}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Button>
                ))}
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
                        <span className="font-medium">{p.amount.toFixed(3)} KWD</span>
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
            disabled={Math.abs(remaining) > 0.01 || loading}
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
