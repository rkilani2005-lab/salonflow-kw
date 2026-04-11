import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Truck, ClipboardList, ArrowDownUp, FileText, ClipboardCheck, PackageCheck, ShieldCheck } from 'lucide-react';
import { ProductsTab } from '@/components/inventory/ProductsTab';
import { SuppliersTab } from '@/components/inventory/SuppliersTab';
import { StockMovementsTab } from '@/components/inventory/StockMovementsTab';
import { PurchaseOrdersTab } from '@/components/inventory/PurchaseOrdersTab';
import { VendorInvoicesTab } from '@/components/inventory/VendorInvoicesTab';
import { StockTakeTab } from '@/components/inventory/stocktake/StockTakeTab';
import { GoodsReceiptsTab } from '@/components/inventory/GoodsReceiptsTab';
import { POApprovalWorkflow } from '@/components/inventory/POApprovalWorkflow';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';

const Inventory = () => {
  const navigate = useNavigate();
  const { data: products = [] } = useProducts();
  const lowStockCount = products.filter(p => p.is_active && p.reorder_point != null && p.current_stock <= p.reorder_point).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground">Manage products, suppliers, and procurement</p>
        </div>
        {lowStockCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2 h-9 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
            onClick={() => navigate('/inventory/reorder')}>
            <AlertTriangle className="h-3.5 w-3.5"/>
            {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} need reorder
          </Button>
        )}
      </div>

      <Tabs defaultValue="products" className="w-full">
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Suppliers</span>
            </TabsTrigger>
            <TabsTrigger value="purchase-orders" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">POs</span>
            </TabsTrigger>
            <TabsTrigger value="approval-workflow" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Approval</span>
            </TabsTrigger>
            <TabsTrigger value="goods-receipts" className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Receipts</span>
            </TabsTrigger>
            <TabsTrigger value="stock-movements" className="flex items-center gap-2">
              <ArrowDownUp className="h-4 w-4" />
              <span className="hidden sm:inline">Movements</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="stock-take" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Stock Take</span>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab />
        </TabsContent>
        <TabsContent value="purchase-orders">
          <PurchaseOrdersTab />
        </TabsContent>
        <TabsContent value="goods-receipts">
          <GoodsReceiptsTab />
        </TabsContent>
        <TabsContent value="stock-movements">
          <StockMovementsTab />
        </TabsContent>
        <TabsContent value="invoices">
          <VendorInvoicesTab />
        </TabsContent>
        <TabsContent value="stock-take">
          <StockTakeTab />
        </TabsContent>
        <TabsContent value="approval-workflow">
          <POApprovalWorkflow />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Inventory;
