import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useVendorPayments,
  INVOICE_STATUS_CONFIG,
  PAYMENT_METHODS,
  type VendorInvoice,
} from '@/hooks/useVendorInvoices';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { format, isPast, parseISO } from 'date-fns';
import { CreditCard, AlertTriangle } from 'lucide-react';

interface InvoiceDetailSheetProps {
  invoice: VendorInvoice | null;
  onClose: () => void;
}

export const InvoiceDetailSheet = ({ invoice, onClose }: InvoiceDetailSheetProps) => {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { data: payments, isLoading: paymentsLoading } = useVendorPayments(invoice?.id || null);

  if (!invoice) return null;

  const balance = invoice.total_amount - invoice.paid_amount;
  const paidPercent = invoice.total_amount > 0 ? (invoice.paid_amount / invoice.total_amount) * 100 : 0;
  const isOverdue = invoice.status !== 'paid' && isPast(parseISO(invoice.due_date));
  const canPay = balance > 0;

  return (
    <>
      <Sheet open={!!invoice} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <span className="font-mono">{invoice.invoice_number}</span>
              <Badge
                className={`text-xs ${isOverdue ? INVOICE_STATUS_CONFIG.overdue.color : INVOICE_STATUS_CONFIG[invoice.status]?.color || ''}`}
                variant="outline"
              >
                {isOverdue ? 'Overdue' : INVOICE_STATUS_CONFIG[invoice.status]?.label}
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Overdue warning */}
            {isOverdue && (
              <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>This invoice is past its due date.</span>
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Supplier</p>
                <p className="font-medium">{invoice.supplier?.name}</p>
              </div>
              {invoice.purchase_order && (
                <div>
                  <p className="text-muted-foreground">Linked PO</p>
                  <p className="font-mono font-medium">{invoice.purchase_order.po_number}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Invoice Date</p>
                <p className="font-medium">{format(parseISO(invoice.invoice_date), 'dd MMM yyyy')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>
                  {format(parseISO(invoice.due_date), 'dd MMM yyyy')}
                </p>
              </div>
            </div>

            <Separator />

            {/* Payment Progress */}
            <div className="space-y-3">
              <h3 className="font-semibold">Payment Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-mono font-semibold text-lg">{invoice.total_amount.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Paid</p>
                  <p className="font-mono font-semibold text-lg">{invoice.paid_amount.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance</p>
                  <p className={`font-mono font-semibold text-lg ${balance > 0 ? 'text-destructive' : ''}`}>
                    {balance.toFixed(3)}
                  </p>
                </div>
              </div>
              <Progress value={paidPercent} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{paidPercent.toFixed(0)}% paid</p>
            </div>

            <Separator />

            {/* Payment History */}
            <div>
              <h3 className="font-semibold mb-3">Payment History</h3>
              {paymentsLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : !payments?.length ? (
                <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-sm">
                            {format(parseISO(payment.payment_date), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {PAYMENT_METHODS.find((m) => m.value === payment.payment_method)?.label || payment.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{payment.amount.toFixed(3)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{payment.reference_number || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Notes */}
            {invoice.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-1">Notes</h3>
                  <p className="text-sm text-muted-foreground">{invoice.notes}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Actions */}
            {canPay && (
              <Button onClick={() => setPaymentOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {invoice && (
        <RecordPaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          invoice={invoice}
        />
      )}
    </>
  );
};
