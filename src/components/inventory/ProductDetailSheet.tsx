import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Product } from '@/hooks/useProducts';

interface Props {
  product: Product | null;
  onClose: () => void;
}

export const ProductDetailSheet = ({ product, onClose }: Props) => {
  if (!product) return null;

  const stockStatus = product.current_stock <= product.reorder_point
    ? 'Critical'
    : product.current_stock <= product.reorder_point * 2
    ? 'Low'
    : 'Good';

  return (
    <Sheet open={!!product} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{product.name}</SheetTitle>
          {product.name_ar && <p className="text-sm text-muted-foreground" dir="rtl">{product.name_ar}</p>}
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex gap-2">
            <Badge className="capitalize">{product.product_type}</Badge>
            <Badge variant={stockStatus === 'Critical' ? 'destructive' : stockStatus === 'Low' ? 'secondary' : 'default'}>
              {stockStatus}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">SKU</p>
              <p className="font-medium">{product.sku || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Barcode</p>
              <p className="font-medium">{product.barcode || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Current Stock</p>
              <p className="font-medium">{product.current_stock} {product.usage_unit}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Reorder Point</p>
              <p className="font-medium">{product.reorder_point} {product.usage_unit}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost Price</p>
              <p className="font-medium">{product.cost_price.toFixed(3)} KWD</p>
            </div>
            <div>
              <p className="text-muted-foreground">Retail Price</p>
              <p className="font-medium">{product.retail_price.toFixed(3)} KWD</p>
            </div>
            <div>
              <p className="text-muted-foreground">Purchase Unit</p>
              <p className="font-medium">{product.purchase_unit} ({product.purchase_unit_quantity} {product.usage_unit})</p>
            </div>
            <div>
              <p className="text-muted-foreground">Batch</p>
              <p className="font-medium">{product.batch_number || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Expiry Date</p>
              <p className="font-medium">{product.expiry_date || '—'}</p>
            </div>
          </div>

          {product.description && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{product.description}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
