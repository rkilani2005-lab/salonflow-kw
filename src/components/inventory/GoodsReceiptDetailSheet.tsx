import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGoodsReceiptItems, GoodsReceipt } from '@/hooks/useGoodsReceipts';
import { format } from 'date-fns';

interface Props {
  receipt: GoodsReceipt | null;
  onClose: () => void;
}

export const GoodsReceiptDetailSheet = ({ receipt, onClose }: Props) => {
  const { data: items, isLoading } = useGoodsReceiptItems(receipt?.id || null);

  if (!receipt) return null;

  const totalValue = items?.reduce((sum, i) => sum + i.quantity_received * i.unit_cost, 0) || 0;

  return (
    <Sheet open={!!receipt} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {receipt.grn_number}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">PO Number</p>
              <p className="font-medium">{receipt.purchase_order?.po_number}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Supplier</p>
              <p className="font-medium">{receipt.purchase_order?.supplier?.name}</p>
              {receipt.purchase_order?.supplier?.name_ar && (
                <p className="text-xs text-muted-foreground" dir="rtl">{receipt.purchase_order.supplier.name_ar}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Received At</p>
              <p className="font-medium">{format(new Date(receipt.received_at), 'dd MMM yyyy HH:mm')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Value</p>
              <p className="font-medium">{totalValue.toFixed(2)} KWD</p>
            </div>
          </div>

          {receipt.notes && (
            <div className="text-sm">
              <p className="text-muted-foreground">Notes</p>
              <p>{receipt.notes}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Received Items</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items?.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{item.product?.name}</p>
                          {item.product?.sku && (
                            <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity_received}</TableCell>
                        <TableCell className="text-right">{item.unit_cost.toFixed(3)}</TableCell>
                        <TableCell className="text-right">{(item.quantity_received * item.unit_cost).toFixed(2)}</TableCell>
                        <TableCell>
                          {item.batch_number ? (
                            <Badge variant="outline" className="text-xs">{item.batch_number}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.expiry_date ? format(new Date(item.expiry_date), 'dd MMM yyyy') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
