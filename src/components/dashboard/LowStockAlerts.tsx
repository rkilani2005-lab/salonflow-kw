import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Package, ShoppingCart, ArrowRight } from 'lucide-react';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCreatePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export function LowStockAlerts() {
  const { data: products, isLoading } = useProducts();
  const { data: suppliers } = useSuppliers();
  const createPO = useCreatePurchaseOrder();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creatingPOFor, setCreatingPOFor] = useState<string | null>(null);

  const lowStockProducts = products?.filter(
    (p) => p.is_active && p.reorder_point != null && p.current_stock <= p.reorder_point
  ) || [];

  const handleQuickPO = async (product: Product) => {
    // Find a preferred supplier or the first active one
    const activeSuppliers = suppliers?.filter((s) => s.is_active);
    if (!activeSuppliers || activeSuppliers.length === 0) {
      toast({
        title: 'No active suppliers',
        description: 'Add a supplier first before creating a PO.',
        variant: 'destructive',
      });
      return;
    }

    setCreatingPOFor(product.id);
    createPO.mutate(
      {
        supplier_id: activeSuppliers[0].id,
        notes: `Auto-generated: Low stock alert for ${product.name}`,
        items: [
          {
            product_id: product.id,
            quantity_ordered: product.reorder_quantity || 1,
            unit_cost: product.cost_price,
          },
        ],
      },
      {
        onSuccess: () => {
          setCreatingPOFor(null);
          toast({ title: 'Draft PO created', description: `PO created for ${product.name}` });
        },
        onSettled: () => setCreatingPOFor(null),
      }
    );
  };

  const getStockSeverity = (product: Product) => {
    if (product.current_stock <= 0) return 'destructive' as const;
    if (product.reorder_point && product.current_stock <= product.reorder_point * 0.5) return 'destructive' as const;
    return 'secondary' as const;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Low Stock Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Low Stock Alerts
          </CardTitle>
          <CardDescription>
            {lowStockProducts.length > 0
              ? `${lowStockProducts.length} product${lowStockProducts.length !== 1 ? 's' : ''} below reorder point`
              : 'All stock levels are healthy'}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')}>
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {lowStockProducts.length === 0 ? (
          <div className="text-center py-6">
            <Package className="h-8 w-8 mx-auto text-emerald-500/40 mb-2" />
            <p className="text-sm text-muted-foreground">All products are well stocked</p>
          </div>
        ) : (
          <ScrollArea className={lowStockProducts.length > 4 ? 'h-[280px]' : ''}>
            <div className="space-y-2">
              {lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Stock: <span className="font-medium text-destructive">{product.current_stock}</span></span>
                        <span>•</span>
                        <span>Reorder: {product.reorder_point}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={getStockSeverity(product)}>
                      {product.current_stock <= 0 ? 'Out' : 'Low'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleQuickPO(product)}
                      disabled={creatingPOFor === product.id}
                    >
                      <ShoppingCart className="h-3 w-3" />
                      <span className="hidden sm:inline">
                        {creatingPOFor === product.id ? 'Creating...' : 'Quick PO'}
                      </span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
