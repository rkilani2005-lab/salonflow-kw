import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProductSearch } from './ProductSearch';
import { TipInput } from './TipInput';
import { DiscountApprovalDialog } from './DiscountApprovalDialog';
import { cn } from '@/lib/utils';
import { Minus, Plus, Trash2, Tag, Percent } from 'lucide-react';
import type { CartItem } from '@/hooks/useTransactions';
import type { Product } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';

interface POSCartProps {
  items: CartItem[];
  onItemsChange: (items: CartItem[]) => void;
  tipAmount: number;
  onTipChange: (amount: number) => void;
  discountType: string | null;
  discountValue: number;
  discountAmount: number;
  discountReason: string;
  discountApprovedBy: string | null;
  onDiscountChange: (type: string | null, value: number, reason: string) => void;
  onDiscountApproved: (approverUserId: string) => void;
  onCheckout: () => void;
}

export function POSCart({
  items,
  onItemsChange,
  tipAmount,
  onTipChange,
  discountType,
  discountValue,
  discountAmount,
  discountReason,
  discountApprovedBy,
  onDiscountChange,
  onDiscountApproved,
  onCheckout,
}: POSCartProps) {
  const [showDiscountApproval, setShowDiscountApproval] = useState(false);
  const [pendingDiscount, setPendingDiscount] = useState<{ type: string; value: number; reason: string } | null>(null);
  const { tenant } = useAuth();

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const taxRate = Number(tenant?.default_tax_rate || 0) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * taxRate * 1000) / 1000;
  const grandTotal = Math.round((taxableAmount + taxAmount + tipAmount) * 1000) / 1000;

  const addProduct = (product: Product) => {
    const existing = items.find(i => i.item_type === 'product' && i.item_id === product.id);
    if (existing) {
      if (existing.quantity + 1 > product.current_stock) return;
      onItemsChange(items.map(i =>
        i === existing
          ? { ...i, quantity: i.quantity + 1, total_price: (i.quantity + 1) * i.unit_price }
          : i
      ));
    } else {
      onItemsChange([...items, {
        item_type: 'product',
        item_id: product.id,
        item_name: product.name,
        item_name_ar: product.name_ar || undefined,
        quantity: 1,
        unit_price: Number(product.retail_price),
        total_price: Number(product.retail_price),
        current_stock: product.current_stock,
      }]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const item = items[index];
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      onItemsChange(items.filter((_, i) => i !== index));
    } else if (item.item_type === 'product' && item.current_stock && newQty > item.current_stock) {
      return;
    } else {
      onItemsChange(items.map((i, idx) =>
        idx === index ? { ...i, quantity: newQty, total_price: newQty * i.unit_price } : i
      ));
    }
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const applyDiscount = () => {
    if (!pendingDiscount) return;
    const { type, value, reason } = pendingDiscount;
    if (value > 0) {
      setShowDiscountApproval(true);
    }
  };

  const handleDiscountApproval = (approverUserId: string) => {
    if (pendingDiscount) {
      onDiscountChange(pendingDiscount.type, pendingDiscount.value, pendingDiscount.reason);
      onDiscountApproved(approverUserId);
      setPendingDiscount(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Product search */}
      <div className="p-4 border-b border-border">
        <ProductSearch onAddProduct={addProduct} />
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p>Cart is empty — add services or products</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={`${item.item_type}-${item.item_id}-${index}`} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-[10px] uppercase font-bold px-1.5 py-0.5 rounded',
                    item.item_type === 'service' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                  )}>
                    {item.item_type}
                  </span>
                  <p className="text-sm font-medium text-foreground truncate">{item.item_name}</p>
                </div>
                {item.item_name_ar && (
                  <p className="text-xs text-muted-foreground" dir="rtl">{item.item_name_ar}</p>
                )}
                <p className="text-xs text-muted-foreground">{item.unit_price.toFixed(3)} KWD each</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => updateQuantity(index, -1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center font-medium text-foreground">{item.quantity}</span>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => updateQuantity(index, 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm font-semibold text-foreground w-20 text-right">
                {item.total_price.toFixed(3)}
              </p>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Footer: Discount, Tip, Totals */}
      <div className="border-t border-border p-4 space-y-3 bg-card">
        {/* Discount section */}
        {!discountApprovedBy && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Select
                value={pendingDiscount?.type || ''}
                onValueChange={(v) => setPendingDiscount({ type: v, value: pendingDiscount?.value || 0, reason: pendingDiscount?.reason || '' })}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Discount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage"><Percent className="inline h-3 w-3 mr-1" />Percentage</SelectItem>
                  <SelectItem value="fixed"><Tag className="inline h-3 w-3 mr-1" />Fixed</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Value"
                className="w-24 h-9"
                value={pendingDiscount?.value || ''}
                onChange={(e) => setPendingDiscount({ type: pendingDiscount?.type || 'fixed', value: parseFloat(e.target.value) || 0, reason: pendingDiscount?.reason || '' })}
                min="0"
              />
              <Input
                placeholder="Reason"
                className="flex-1 h-9"
                value={pendingDiscount?.reason || ''}
                onChange={(e) => setPendingDiscount({ ...pendingDiscount!, reason: e.target.value })}
              />
              <Button size="sm" variant="secondary" className="h-9" onClick={applyDiscount} disabled={!pendingDiscount?.value}>
                Apply
              </Button>
            </div>
          </div>
        )}

        {discountApprovedBy && discountAmount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : `${discountValue} KWD`})</span>
            <span>-{discountAmount.toFixed(3)} KWD</span>
          </div>
        )}

        <TipInput subtotal={subtotal} tipAmount={tipAmount} onTipChange={onTipChange} />

        <Separator />

        {/* Totals */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{subtotal.toFixed(3)} KWD</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-{discountAmount.toFixed(3)} KWD</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
              <span>{taxAmount.toFixed(3)} KWD</span>
            </div>
          )}
          {tipAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tip</span>
              <span>{tipAmount.toFixed(3)} KWD</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold text-foreground">
            <span>Grand Total</span>
            <span>{grandTotal.toFixed(3)} KWD</span>
          </div>
        </div>

        <Button
          className="w-full h-14 text-lg font-semibold"
          onClick={onCheckout}
          disabled={items.length === 0 || grandTotal <= 0}
        >
          Proceed to Payment
        </Button>
      </div>

      <DiscountApprovalDialog
        open={showDiscountApproval}
        onOpenChange={setShowDiscountApproval}
        discountAmount={
          pendingDiscount?.type === 'percentage'
            ? Math.round(subtotal * (pendingDiscount.value / 100) * 1000) / 1000
            : pendingDiscount?.value || 0
        }
        discountReason={pendingDiscount?.reason || ''}
        onApproved={handleDiscountApproval}
      />
    </div>
  );
}
