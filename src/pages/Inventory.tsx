import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Truck, ClipboardList, ArrowDownUp, FileText, ClipboardCheck, PackageCheck } from 'lucide-react';
import { ProductsTab } from '@/components/inventory/ProductsTab';
import { SuppliersTab } from '@/components/inventory/SuppliersTab';
import { StockMovementsTab } from '@/components/inventory/StockMovementsTab';
import { PurchaseOrdersTab } from '@/components/inventory/PurchaseOrdersTab';
import { VendorInvoicesTab } from '@/components/inventory/VendorInvoicesTab';
import { StockTakeTab } from '@/components/inventory/stocktake/StockTakeTab';
import { GoodsReceiptsTab } from '@/components/inventory/GoodsReceiptsTab';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const Inventory = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground">Manage products, suppliers, and procurement</p>
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
      </Tabs>
    </div>
  );
};

export default Inventory;
