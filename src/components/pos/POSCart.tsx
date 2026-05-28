import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProductSearch } from './ProductSearch';
import { TipInput } from './TipInput';
import { DiscountApprovalDialog } from './DiscountApprovalDialog';
import { cn } from '@/lib/utils';
import { Minus, Plus, Trash2, Tag, Percent, User, Package as PackageIcon } from 'lucide-react';
import type { CartItem } from '@/hooks/useTransactions';
import type { Product } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/hooks/useStaff';
import { useClientPackages, type ClientPackage } from '@/hooks/usePackages';

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
  checkoutDisabled?: boolean;
  clientId?: string | null;
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
  checkoutDisabled = false,
  clientId,
}: POSCartProps) {
  const [showDiscountApproval, setShowDiscountApproval] = useState(false);
  const [pendingDiscount, setPendingDiscount] = useState<{ type: string; value: number; reason: string } | null>(null);
  const { tenant } = useAuth();
  const { data: staffList } = useStaff();
  const { data: clientPackages } = useClientPackages(clientId || null);

  // Active, non-expired packages with sessions remaining, indexed by covered service_id
  const eligibleByService = useMemo(() => {
    const map = new Map<string, ClientPackage[]>();
    const today = new Date().toISOString().slice(0, 10);
    (clientPackages || []).forEach((cp) => {
      if (cp.status !== 'active') return;
      if ((cp.sessions_remaining ?? 0) <= 0) return;
      if (cp.expires_at && cp.expires_at < today) return;
      const svcId = (cp.package as any)?.service_id;
      if (!svcId) return;
      if (!map.has(svcId)) map.set(svcId, []);
      map.get(svcId)!.push(cp);
    });
    // Sort each bucket: soonest expiry first (nulls last)
    map.forEach((arr) =>
      arr.sort((a, b) => {
        if (!a.expires_at && !b.expires_at) return 0;
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return a.expires_at.localeCompare(b.expires_at);
      }),
    );
    return map;
  }, [clientPackages]);

  const toggleRedeem = (index: number, packageId: string | null) => {
    onItemsChange(items.map((it, idx) => {
      if (idx !== index) return it;
      if (packageId) {
        // Snapshot original price, then zero the line
        const orig = it.original_unit_price ?? it.unit_price;
        return { ...it, redeem_from_package_id: packageId, original_unit_price: orig, unit_price: 0, total_price: 0 };
      } else {
        // Restore original price
        const orig = it.original_unit_price ?? it.unit_price;
        return { ...it, redeem_from_package_id: undefined, original_unit_price: undefined, unit_price: orig, total_price: orig * it.quantity };
      }
    }));
  };
  const updateStaff = (index: number, staffId: string | null) => {
    onItemsChange(items.map((i, idx) =>
      idx === index ? { ...i, staff_commission_id: staffId || undefined } : i
    ));
  };

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
          items.map((item, index) => {
            const eligible = item.item_type === 'service' && item.item_id
              ? (eligibleByService.get(item.item_id) || [])
              : [];
            const selectedPkgId = item.redeem_from_package_id || '';
            return (
            <div key={`${item.item_type}-${item.item_id}-${index}`} className="flex flex-col gap-2 p-3 bg-card rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] uppercase font-bold px-1.5 py-0.5 rounded',
                      item.item_type === 'service' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                    )}>
                      {item.item_type}
                    </span>
                    <p className="text-sm font-medium text-foreground truncate">{item.item_name}</p>
                    {selectedPkgId && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Package
                      </span>
                    )}
                  </div>
                  {item.item_name_ar && (
                    <p className="text-xs text-muted-foreground" dir="rtl">{item.item_name_ar}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {selectedPkgId
                      ? <>Redeemed (0.000 KWD) <span className="line-through ml-1">{(item.original_unit_price ?? item.unit_price).toFixed(3)} KWD</span></>
                      : <>{item.unit_price.toFixed(3)} KWD each</>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" aria-label="Decrease quantity" className="h-9 w-9" onClick={() => updateQuantity(index, -1)} disabled={!!selectedPkgId}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium text-foreground">{item.quantity}</span>
                  <Button variant="outline" size="icon" aria-label="Increase quantity" className="h-9 w-9" onClick={() => updateQuantity(index, 1)} disabled={!!selectedPkgId}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {item.item_type === 'service' && (
                  <Select
                    value={item.staff_commission_id || ''}
                    onValueChange={(v) => updateStaff(index, v || null)}
                  >
                    <SelectTrigger className="w-28 h-9 text-xs" aria-label="Assign staff">
                      <User className="h-3 w-3 mr-1 flex-shrink-0" />
                      <SelectValue placeholder="Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      {(staffList || []).filter((s: any) => s.is_active).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-sm font-semibold text-foreground w-20 text-right">
                  {item.total_price.toFixed(3)}
                </p>
                <Button variant="ghost" size="icon" aria-label="Remove item" className="h-8 w-8 shrink-0" onClick={() => removeItem(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {eligible.length > 0 && (
                <div className="flex items-center gap-2 pl-1 pt-1 border-t border-border/50">
                  <PackageIcon className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">Redeem from package:</span>
                  <Select
                    value={selectedPkgId || '__none__'}
                    onValueChange={(v) => toggleRedeem(index, v === '__none__' ? null : v)}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1 max-w-xs">
                      <SelectValue placeholder="No — pay normally" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No — pay normally</SelectItem>
                      {eligible.map((cp) => (
                        <SelectItem key={cp.id} value={cp.id}>
                          {(cp.package as any)?.name || 'Package'} — {cp.sessions_remaining} left
                          {cp.expires_at ? ` · exp ${cp.expires_at}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            );
          })
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
          disabled={checkoutDisabled || items.length === 0 || grandTotal <= 0}
        >
          {checkoutDisabled ? 'Already Paid' : 'Proceed to Payment'}
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
