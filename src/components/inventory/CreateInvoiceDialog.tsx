import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSuppliers } from '@/hooks/useSuppliers';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useCreateVendorInvoice } from '@/hooks/useVendorInvoices';
import { format } from 'date-fns';

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateInvoiceDialog = ({ open, onOpenChange }: CreateInvoiceDialogProps) => {
  const [supplierId, setSupplierId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');

  const { data: suppliers } = useSuppliers();
  const { data: purchaseOrders } = usePurchaseOrders();
  const createInvoice = useCreateVendorInvoice();

  // Filter POs by selected supplier (only received/partially_received ones)
  const filteredPOs = purchaseOrders?.filter(
    (po) =>
      po.supplier_id === supplierId &&
      ['sent', 'partially_received', 'received'].includes(po.status)
  );

  const handlePOSelect = (poId: string) => {
    setPurchaseOrderId(poId);
    const po = purchaseOrders?.find((p) => p.id === poId);
    if (po) {
      setTotalAmount(po.total_amount.toString());
    }
  };

  const handleSubmit = () => {
    if (!supplierId || !invoiceNumber || !dueDate || !totalAmount) return;

    createInvoice.mutate(
      {
        supplier_id: supplierId,
        purchase_order_id: purchaseOrderId || undefined,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        total_amount: Number(totalAmount),
        notes: notes || undefined,
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
    setSupplierId('');
    setPurchaseOrderId('');
    setInvoiceNumber('');
    setInvoiceDate(format(new Date(), 'yyyy-MM-dd'));
    setDueDate('');
    setTotalAmount('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Vendor Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Supplier *</Label>
            <Select value={supplierId} onValueChange={(v) => { setSupplierId(v); setPurchaseOrderId(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.filter((s) => s.is_active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {supplierId && filteredPOs && filteredPOs.length > 0 && (
            <div className="space-y-2">
              <Label>Link to Purchase Order (optional)</Label>
              <Select value={purchaseOrderId} onValueChange={handlePOSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PO (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPOs.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} — {po.total_amount.toFixed(3)} KWD
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Invoice Number *</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2025-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice Date *</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Due Date *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Total Amount (KWD) *</Label>
            <Input
              type="number"
              min={0}
              step={0.001}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.000"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!supplierId || !invoiceNumber || !dueDate || !totalAmount || createInvoice.isPending}
          >
            {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
