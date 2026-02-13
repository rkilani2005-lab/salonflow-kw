import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecordPayment, PAYMENT_METHODS, type VendorInvoice } from '@/hooks/useVendorInvoices';
import type { Database } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type PaymentMethod = Database['public']['Enums']['vendor_payment_method'];

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: VendorInvoice;
}

export const RecordPaymentDialog = ({ open, onOpenChange, invoice }: RecordPaymentDialogProps) => {
  const balance = invoice.total_amount - invoice.paid_amount;
  const [amount, setAmount] = useState(balance.toString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const recordPayment = useRecordPayment();

  const handleSubmit = () => {
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0 || parsedAmount > balance) return;

    recordPayment.mutate(
      {
        vendor_invoice_id: invoice.id,
        amount: parsedAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_number: referenceNumber || undefined,
        notes: notes || undefined,
        invoice_total: invoice.total_amount,
        invoice_paid: invoice.paid_amount,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setAmount(balance.toString());
    setPaymentMethod('cash');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setReferenceNumber('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {invoice.invoice_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-md bg-muted text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding Balance</span>
              <span className="font-mono font-semibold">{balance.toFixed(3)} {invoice.currency}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input
              type="number"
              min={0.001}
              max={balance}
              step={0.001}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {Number(amount) > balance && (
              <p className="text-xs text-destructive">Cannot exceed outstanding balance</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Payment Date *</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Reference Number</Label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. Transfer #, Cheque #"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!Number(amount) || Number(amount) > balance || Number(amount) <= 0 || recordPayment.isPending}
          >
            {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
