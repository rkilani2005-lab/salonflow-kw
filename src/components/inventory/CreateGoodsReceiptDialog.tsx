import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { usePurchaseOrders, usePurchaseOrderItems } from '@/hooks/usePurchaseOrders';
import { useCreateGoodsReceipt } from '@/hooks/useGoodsReceipts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReceiveLine {
  product_id: string;
  po_item_id: string;
  quantity_ordered: number;
  quantity_previously_received: number;
  quantity_to_receive: number;
  unit_cost: number;
  batch_number: string;
  expiry_date: string;
  product_name: string;
  sku: string | null;
}

export const CreateGoodsReceiptDialog = ({ open, onOpenChange }: Props) => {
  const [selectedPoId, setSelectedPoId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ReceiveLine[]>([]);

  const { data: purchaseOrders } = usePurchaseOrders();
  const { data: poItems } = usePurchaseOrderItems(selectedPoId || null);
  const createGR = useCreateGoodsReceipt();

  // Filter POs that can receive goods
  const receivablePOs = purchaseOrders?.filter(po =>
    ['approved', 'sent', 'partially_received'].includes(po.status)
  );

  const handleSelectPO = (poId: string) => {
    setSelectedPoId(poId);
    setLines([]);
  };

  // When PO items load, populate lines
  const populateLines = () => {
    if (!poItems) return;
    const newLines: ReceiveLine[] = poItems.map(item => ({
      product_id: item.product_id,
      po_item_id: item.id,
      quantity_ordered: item.quantity_ordered,
      quantity_previously_received: item.quantity_received,
      quantity_to_receive: Math.max(0, item.quantity_ordered - item.quantity_received),
      unit_cost: item.unit_cost,
      batch_number: '',
      expiry_date: '',
      product_name: item.product?.name || '',
      sku: item.product?.sku || null,
    }));
    setLines(newLines);
  };

  // Auto-populate when poItems change
  if (poItems && poItems.length > 0 && lines.length === 0 && selectedPoId) {
    populateLines();
  }

  const updateLine = (index: number, field: keyof ReceiveLine, value: any) => {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const handleSubmit = async () => {
    const itemsToReceive = lines.filter(l => l.quantity_to_receive > 0);
    if (itemsToReceive.length === 0) return;

    await createGR.mutateAsync({
      purchase_order_id: selectedPoId,
      notes: notes || undefined,
      items: itemsToReceive.map(l => ({
        product_id: l.product_id,
        po_item_id: l.po_item_id,
        quantity_received: l.quantity_to_receive,
        unit_cost: l.unit_cost,
        batch_number: l.batch_number || undefined,
        expiry_date: l.expiry_date || undefined,
      })),
    });

    setSelectedPoId('');
    setNotes('');
    setLines([]);
    onOpenChange(false);
  };

  const selectedPO = purchaseOrders?.find(po => po.id === selectedPoId);
  const totalReceiving = lines.reduce((sum, l) => sum + l.quantity_to_receive * l.unit_cost, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Goods</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* PO Selection */}
          <div>
            <Label>Purchase Order</Label>
            <Select value={selectedPoId} onValueChange={handleSelectPO}>
              <SelectTrigger><SelectValue placeholder="Select a Purchase Order" /></SelectTrigger>
              <SelectContent>
                {receivablePOs?.map(po => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.po_number} — {po.supplier?.name} ({po.status.replace('_', ' ')})
                  </SelectItem>
                ))}
                {(!receivablePOs || receivablePOs.length === 0) && (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    No POs available for receiving
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedPO && (
            <div className="flex gap-3 text-sm">
              <Badge variant="outline">Supplier: {selectedPO.supplier?.name}</Badge>
              <Badge variant="outline">Total: {selectedPO.total_amount.toFixed(2)} KWD</Badge>
            </div>
          )}

          {/* Line Items */}
          {lines.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Prev. Received</TableHead>
                    <TableHead className="text-right w-24">Receiving</TableHead>
                    <TableHead className="text-right w-24">Unit Cost</TableHead>
                    <TableHead className="w-28">Batch #</TableHead>
                    <TableHead className="w-32">Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => {
                    const remaining = line.quantity_ordered - line.quantity_previously_received;
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <p className="font-medium text-sm">{line.product_name}</p>
                          {line.sku && <p className="text-xs text-muted-foreground">{line.sku}</p>}
                        </TableCell>
                        <TableCell className="text-right">{line.quantity_ordered}</TableCell>
                        <TableCell className="text-right">{line.quantity_previously_received}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            className="w-20 h-8 text-right text-sm"
                            value={line.quantity_to_receive}
                            onChange={e => updateLine(idx, 'quantity_to_receive', Math.min(remaining, Math.max(0, Number(e.target.value))))}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step={0.001}
                            className="w-20 h-8 text-right text-sm"
                            value={line.unit_cost}
                            onChange={e => updateLine(idx, 'unit_cost', Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-sm"
                            placeholder="Batch"
                            value={line.batch_number}
                            onChange={e => updateLine(idx, 'batch_number', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            className="h-8 text-sm"
                            value={line.expiry_date}
                            onChange={e => updateLine(idx, 'expiry_date', e.target.value)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {lines.length > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                Receiving {lines.filter(l => l.quantity_to_receive > 0).length} of {lines.length} items
              </span>
              <span className="font-semibold">Total: {totalReceiving.toFixed(2)} KWD</span>
            </div>
          )}

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createGR.isPending || lines.filter(l => l.quantity_to_receive > 0).length === 0}
            >
              {createGR.isPending ? 'Processing...' : 'Receive & Update Stock'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
