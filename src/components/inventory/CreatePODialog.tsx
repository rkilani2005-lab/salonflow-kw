import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useCreatePurchaseOrder } from '@/hooks/usePurchaseOrders';

interface LineItem {
  product_id: string;
  product_name: string;
  quantity_ordered: number;
  unit_cost: number;
  usage_unit: string;
}

interface CreatePODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreatePODialog = ({ open, onOpenChange }: CreatePODialogProps) => {
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const { data: suppliers } = useSuppliers();
  const { data: products } = useProducts();
  const createPO = useCreatePurchaseOrder();

  const addItem = () => {
    const product = products?.find((p) => p.id === selectedProductId);
    if (!product) return;
    if (items.some((i) => i.product_id === product.id)) return;

    setItems([
      ...items,
      {
        product_id: product.id,
        product_name: product.name,
        quantity_ordered: product.reorder_quantity || 1,
        unit_cost: product.cost_price,
        usage_unit: product.usage_unit || 'Unit',
      },
    ]);
    setSelectedProductId('');
  };

  const updateItem = (index: number, field: keyof LineItem, value: number) => {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, i) => sum + i.quantity_ordered * i.unit_cost, 0);

  const handleSubmit = () => {
    if (!supplierId || items.length === 0) return;

    createPO.mutate(
      {
        supplier_id: supplierId,
        notes: notes || undefined,
        payment_terms: paymentTerms || undefined,
        items: items.map(({ product_id, quantity_ordered, unit_cost }) => ({
          product_id,
          quantity_ordered,
          unit_cost,
        })),
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
    setNotes('');
    setPaymentTerms('');
    setItems([]);
    setSelectedProductId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Supplier Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
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
            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Input
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30"
              />
            </div>
          </div>

          {/* Add Line Item */}
          <div className="space-y-2">
            <Label>Add Product</Label>
            <div className="flex gap-2">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select product to add" />
                </SelectTrigger>
                <SelectContent>
                  {products
                    ?.filter((p) => p.is_active && !items.some((i) => i.product_id === p.id))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(${p.sku})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addItem} disabled={!selectedProductId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Line Items Table */}
          {items.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-[120px]">Qty</TableHead>
                    <TableHead className="w-[140px]">Unit Cost</TableHead>
                    <TableHead className="text-right w-[120px]">Line Total</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.product_id}>
                      <TableCell>
                        <span className="font-medium">{item.product_name}</span>
                        <span className="text-xs text-muted-foreground ml-1">({item.usage_unit})</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity_ordered}
                          onChange={(e) => updateItem(index, 'quantity_ordered', Number(e.target.value))}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.001}
                          value={item.unit_cost}
                          onChange={(e) => updateItem(index, 'unit_cost', Number(e.target.value))}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(item.quantity_ordered * item.unit_cost).toFixed(3)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" aria-label="Remove item" className="h-7 w-7" onClick={() => removeItem(index)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-semibold">Total</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{total.toFixed(3)} KWD</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!supplierId || items.length === 0 || createPO.isPending}
          >
            {createPO.isPending ? 'Creating...' : 'Create PO (Draft)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
