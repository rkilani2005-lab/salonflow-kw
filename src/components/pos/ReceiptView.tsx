import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Printer, Download, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTransactionById } from '@/hooks/useTransactions';
import { RefundDialog } from './RefundDialog';
import type { CartItem, PaymentEntry } from '@/hooks/useTransactions';

interface ReceiptViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  // When opened from the POS sale flow these are passed directly. When
  // opened standalone (e.g. "View Receipt" on a past appointment), they
  // are omitted and derived from the fetched transaction instead.
  items?: CartItem[];
  payments?: PaymentEntry[];
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  tipAmount?: number;
  grandTotal?: number;
  clientName?: string;
  staffName?: string;
  createdAt?: string;
}

export function ReceiptView({
  open,
  onOpenChange,
  transactionId,
  items: itemsProp,
  payments: paymentsProp,
  subtotal: subtotalProp,
  discountAmount: discountAmountProp,
  taxAmount: taxAmountProp,
  tipAmount: tipAmountProp,
  grandTotal: grandTotalProp,
  clientName: clientNameProp,
  staffName,
  createdAt: createdAtProp,
}: ReceiptViewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { tenant, hasRole } = useAuth();
  const [refundOpen, setRefundOpen] = useState(false);
  // Roles allowed to issue refunds.  Cashiers need it for daily
  // operations; inventory_clerks may refund product-only sales;
  // manager/owner always.  Stylists, receptionists, accountants,
  // readonly cannot refund — they'd need to escalate to a cashier
  // or manager.
  const canRefund = hasRole('owner') || hasRole('manager') || hasRole('cashier') || hasRole('inventory_clerk');

  // Fetch full transaction data for the refund dialog
  const { data: fullTransaction } = useTransactionById(open ? transactionId : null);

  // Effective values: use the props passed by the POS sale flow when
  // present; otherwise derive from the fetched transaction so the receipt
  // can be opened standalone (e.g. "View Receipt" on a past appointment).
  const ft: any = fullTransaction;
  const items: CartItem[] = itemsProp ?? (ft?.transaction_items ?? []).map((ti: any) => ({
    item_type: ti.item_type,
    item_id: ti.item_id ?? '',
    item_name: ti.item_name,
    item_name_ar: ti.item_name_ar ?? undefined,
    quantity: ti.quantity,
    unit_price: Number(ti.unit_price),
    total_price: Number(ti.total_price),
    staff_commission_id: ti.staff_commission_id ?? undefined,
  }));
  const payments: PaymentEntry[] = paymentsProp ?? (ft?.transaction_payments ?? []).map((tp: any) => ({
    payment_method: tp.payment_method,
    amount: Number(tp.amount),
  }));
  const subtotal       = subtotalProp       ?? Number(ft?.subtotal ?? 0);
  const discountAmount = discountAmountProp ?? Number(ft?.discount_amount ?? 0);
  const taxAmount      = taxAmountProp      ?? Number(ft?.tax_amount ?? 0);
  const tipAmount      = tipAmountProp      ?? Number(ft?.tip_amount ?? 0);
  const grandTotal     = grandTotalProp     ?? Number(ft?.grand_total ?? 0);
  const clientName     = clientNameProp     ?? ft?.client_name ?? undefined;
  const createdAt      = createdAtProp      ?? ft?.created_at ?? new Date().toISOString();

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !receiptRef.current) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${transactionId.slice(0, 8)}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { font-family: 'Courier New', monospace; font-size: 12px; width: 58mm; margin: 0 auto; padding: 4mm; }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 4px 0; }
            .row { display: flex; justify-content: space-between; }
            .ar { direction: rtl; font-family: 'Arial', sans-serif; font-size: 11px; color: #666; }
          </style>
        </head>
        <body>${receiptRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Cash / نقداً',
    knet: 'K-NET / كي نت',
    credit_card: 'Credit Card / بطاقة ائتمان',
    gift_card: 'Gift Card / بطاقة هدية',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>

          <div ref={receiptRef} className="font-mono text-xs space-y-2 p-4 bg-white text-black rounded">
            {/* Header */}
            <div className="text-center space-y-1">
              {tenant?.logo_url && (
                <img
                  src={tenant.logo_url}
                  alt={tenant?.name || 'Logo'}
                  className="h-14 w-14 object-contain mx-auto mb-1"
                  style={{ borderRadius: '4px' }}
                />
              )}
              <p className="text-base font-bold">{tenant?.name || 'Salon'}</p>
              <p className="text-[10px] text-gray-500">TAX INVOICE / فاتورة ضريبية</p>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Meta info */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Txn #:</span>
                <span>{transactionId.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(createdAt).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span>{new Date(createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {clientName && (
                <div className="flex justify-between">
                  <span>Client:</span>
                  <span>{clientName}</span>
                </div>
              )}
              {staffName && (
                <div className="flex justify-between">
                  <span>Staff:</span>
                  <span>{staffName}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Items */}
            <div className="space-y-1">
              {items.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between">
                    <span className="flex-1 truncate">{item.item_name}</span>
                    <span className="ml-2">{item.total_price.toFixed(3)}</span>
                  </div>
                  {item.item_name_ar && (
                    <p className="text-[10px] text-gray-500" dir="rtl">{item.item_name_ar}</p>
                  )}
                  {item.quantity > 1 && (
                    <p className="text-[10px] text-gray-500 pl-2">
                      {item.quantity} × {item.unit_price.toFixed(3)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Totals */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal / المجموع</span>
                <span>{subtotal.toFixed(3)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount / خصم</span>
                  <span>-{discountAmount.toFixed(3)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax / الضريبة</span>
                  <span>{taxAmount.toFixed(3)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tip / إكرامية</span>
                  <span>{tipAmount.toFixed(3)}</span>
                </div>
              )}
              <div className="border-t border-dashed border-gray-400 my-1" />
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL / الإجمالي</span>
                <span>{grandTotal.toFixed(3)} KWD</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Payment breakdown */}
            <div className="space-y-0.5 text-[11px]">
              <p className="font-bold">Payment / الدفع</p>
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>{PAYMENT_LABELS[p.payment_method] || p.payment_method}</span>
                  <span>{p.amount.toFixed(3)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            <p className="text-center text-[10px] text-gray-500">
              Thank you for your visit!<br />
              !شكراً لزيارتكم
            </p>
          </div>

          <div className="flex gap-2 mt-2">
            <Button onClick={handlePrint} className="flex-1 h-12">
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
            <Button variant="outline" onClick={handlePrint} className="flex-1 h-12">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            {/* Refunds are money-out actions.  Hide entirely for staff
                who shouldn't issue them (stylists, receptionists,
                readonly, accountants).  Owners / managers / cashiers
                / inventory_clerks can initiate.  Defence-in-depth:
                RefundDialog also checks the role on mutation entry. */}
            {canRefund && (
              <Button
                variant="outline"
                onClick={() => setRefundOpen(true)}
                className="h-12 px-4 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
                title="Process refund"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        transaction={fullTransaction as any}
        onRefundComplete={() => {
          setRefundOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
