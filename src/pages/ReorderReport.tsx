import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCreatePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertTriangle, ShoppingCart, Package, Truck,
  RefreshCw, ChevronRight, CheckCircle2, XCircle,
  ArrowLeft, Loader2, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnrichedProduct extends Product {
  urgency: 'critical' | 'low' | 'warning';
  shortage: number;
  suggestedQty: number;
  supplierName?: string;
}

export default function ReorderReport() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const { data: allProducts = [], isLoading, refetch } = useProducts();
  const { data: suppliers = [] } = useSuppliers();
  const createPO = useCreatePurchaseOrder();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creatingBulk, setCreatingBulk] = useState(false);
  const [createdPOs, setCreatedPOs] = useState<Set<string>>(new Set());

  // Filter to below-reorder-point products only
  const lowStock: EnrichedProduct[] = allProducts
    .filter(p => p.is_active && p.reorder_point != null && p.current_stock <= p.reorder_point)
    .map(p => {
      const urgency: EnrichedProduct['urgency'] =
        p.current_stock <= 0 ? 'critical' :
        p.reorder_point && p.current_stock <= p.reorder_point * 0.5 ? 'critical' : 'low';
      return {
        ...p,
        urgency,
        shortage: Math.max(0, (p.reorder_point || 0) - p.current_stock),
        suggestedQty: p.reorder_quantity || Math.max(1, (p.reorder_point || 1) * 2),
      };
    })
    .sort((a, b) => {
      if (a.urgency === 'critical' && b.urgency !== 'critical') return -1;
      if (a.urgency !== 'critical' && b.urgency === 'critical') return 1;
      return a.current_stock - b.current_stock;
    });

  const criticalCount = lowStock.filter(p => p.urgency === 'critical').length;
  const lowCount      = lowStock.filter(p => p.urgency === 'low').length;
  const totalValue    = lowStock.reduce((s, p) => s + p.suggestedQty * p.cost_price, 0);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    const uncreated = lowStock.filter(p => !createdPOs.has(p.id)).map(p => p.id);
    if (selected.size === uncreated.length) setSelected(new Set());
    else setSelected(new Set(uncreated));
  };

  // Create individual PO for a single product
  const handleSinglePO = async (product: EnrichedProduct) => {
    const firstSupplier = suppliers.find(s => s.is_active);
    if (!firstSupplier) {
      toast({ title: 'No active suppliers', description: 'Add a supplier first', variant: 'destructive' });
      return;
    }
    await createPO.mutateAsync({
      supplier_id: firstSupplier.id,
      notes: `Reorder alert: ${product.name} — stock: ${product.current_stock}, reorder point: ${product.reorder_point}`,
      items: [{ product_id: product.id, quantity_ordered: product.suggestedQty, unit_cost: product.cost_price }],
    });
    setCreatedPOs(prev => new Set([...prev, product.id]));
    toast({ title: `✅ PO created for ${product.name}` });
  };

  // Create bulk PO(s) grouped by suggested supplier (or first active)
  const handleBulkPO = async () => {
    if (selected.size === 0) return;
    setCreatingBulk(true);
    try {
      const firstSupplier = suppliers.find(s => s.is_active);
      if (!firstSupplier) throw new Error('No active suppliers');

      const items = [...selected]
        .map(id => lowStock.find(p => p.id === id))
        .filter(Boolean)
        .map(p => ({ product_id: p!.id, quantity_ordered: p!.suggestedQty, unit_cost: p!.cost_price }));

      await createPO.mutateAsync({
        supplier_id: firstSupplier.id,
        notes: `Bulk reorder — ${items.length} products`,
        items,
      });

      setCreatedPOs(prev => new Set([...prev, ...selected]));
      setSelected(new Set());
      toast({ title: `✅ Bulk PO created for ${items.length} products` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingBulk(false);
    }
  };

  const urgencyBadge = (u: string) => {
    if (u === 'critical') return (
      <Badge className="text-[9px] h-4 px-1.5 rounded-sm font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
        ● Critical
      </Badge>
    );
    return (
      <Badge className="text-[9px] h-4 px-1.5 rounded-sm font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
        ● Low
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => navigate('/inventory')}>
          <ArrowLeft className="h-3.5 w-3.5"/>{ar ? 'المخزون' : 'Inventory'}
        </Button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground"/>
        <span className="text-sm font-semibold">{ar ? 'تقرير إعادة الطلب' : 'Reorder Report'}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {ar ? 'المخزون' : 'Inventory'}
          </p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.04em' }}>
            {ar ? 'تقرير إعادة الطلب' : 'Reorder Report'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ar ? 'المنتجات التي وصلت لنقطة إعادة الطلب أو أقل منها' : 'Products at or below their reorder point'}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5"/>{ar ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: ar ? 'بحاجة طلب' : 'Need Reorder', val: lowStock.length, icon: Package, color: 'text-primary' },
          { label: ar ? 'حرج' : 'Critical',        val: criticalCount,     icon: AlertTriangle, color: 'text-red-500' },
          { label: ar ? 'منخفض' : 'Low Stock',      val: lowCount,          icon: Info,          color: 'text-amber-500' },
          { label: ar ? 'تكلفة مقترحة' : 'Est. PO Cost', val: `${totalValue.toFixed(3)} ${currency}`, icon: ShoppingCart, color: 'text-emerald-600' },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label} className="border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <Icon className={cn('h-4 w-4', color)}/>
              </div>
              <p className={cn('stat-number text-xl font-black', color)}>{val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk action bar */}
      {lowStock.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-md border bg-card">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selected.size > 0 && selected.size === lowStock.filter(p => !createdPOs.has(p.id)).length}
              onCheckedChange={toggleAll}
            />
            <span className="text-sm text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : (ar ? 'تحديد الكل' : 'Select all')}
            </span>
          </div>
          <Button size="sm" className="gap-1.5 h-8" onClick={handleBulkPO}
            disabled={selected.size === 0 || creatingBulk}>
            {creatingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <ShoppingCart className="h-3.5 w-3.5"/>}
            {ar ? `إنشاء أمر شراء (${selected.size})` : `Create PO for ${selected.size} item${selected.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}

      {/* Product list */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_,i) => <Skeleton key={i} className="h-20 rounded-md"/>)}</div>
      ) : lowStock.length === 0 ? (
        <div className="border rounded-md p-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3 opacity-50"/>
          <p className="font-semibold text-base">{ar ? 'المخزون بخير!' : 'Stock levels are healthy!'}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {ar ? 'لا توجد منتجات بحاجة إعادة طلب حالياً' : 'No products are currently below their reorder point'}
          </p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden divide-y divide-border">
          {lowStock.map(product => {
            const done = createdPOs.has(product.id);
            const isSelected = selected.has(product.id);
            const stockPct = product.reorder_point
              ? Math.round((product.current_stock / product.reorder_point) * 100)
              : 0;

            return (
              <div key={product.id} className={cn(
                'flex items-center gap-4 px-5 py-4 transition-colors',
                done ? 'bg-emerald-50/50 dark:bg-emerald-950/10 opacity-60' : 'bg-card hover:bg-muted/20',
                isSelected && !done ? 'bg-primary/3 border-l-2 border-primary' : ''
              )}>
                {/* Checkbox */}
                <Checkbox
                  checked={isSelected}
                  disabled={done}
                  onCheckedChange={() => !done && toggleSelect(product.id)}
                />

                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold">{product.name}</p>
                    {urgencyBadge(product.urgency)}
                    {product.sku && (
                      <span className="text-[10px] text-muted-foreground font-mono">{product.sku}</span>
                    )}
                    {done && (
                      <Badge className="text-[9px] h-4 px-1.5 rounded-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                        ✓ PO Created
                      </Badge>
                    )}
                  </div>

                  {/* Stock bar */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', product.urgency === 'critical' ? 'bg-red-500' : 'bg-amber-400')}
                        style={{ width: `${Math.min(100, stockPct)}%` }}/>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {product.current_stock} / {product.reorder_point} {product.usage_unit || 'units'}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    {ar ? 'الطلب المقترح:' : 'Suggest ordering:'} <strong>{product.suggestedQty}</strong> {product.usage_unit || 'units'} · {ar ? 'التكلفة:' : 'Cost:'} <strong>{(product.suggestedQty * product.cost_price).toFixed(3)} {currency}</strong>
                  </p>
                </div>

                {/* Quick PO button */}
                {!done && (
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs flex-shrink-0"
                    onClick={() => handleSinglePO(product)} disabled={createPO.isPending}>
                    {createPO.isPending ? <Loader2 className="h-3 w-3 animate-spin"/> : <Truck className="h-3 w-3"/>}
                    {ar ? 'طلب' : 'Order'}
                  </Button>
                )}
                {done && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0"/>}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer tip */}
      {lowStock.length > 0 && suppliers.length === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5"/>
          <span>{ar ? 'أضف مورداً على الأقل لإنشاء أوامر الشراء تلقائياً.' : 'Add at least one supplier to use the Quick PO feature.'}</span>
        </div>
      )}
    </div>
  );
}
