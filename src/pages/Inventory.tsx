import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Truck, ClipboardList, ArrowDownUp, FileText } from 'lucide-react';
import { ProductsTab } from '@/components/inventory/ProductsTab';
import { SuppliersTab } from '@/components/inventory/SuppliersTab';
import { StockMovementsTab } from '@/components/inventory/StockMovementsTab';
import { PurchaseOrdersTab } from '@/components/inventory/PurchaseOrdersTab';

const Inventory = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground">Manage products, suppliers, and procurement</p>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
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
            <span className="hidden sm:inline">Purchase Orders</span>
          </TabsTrigger>
          <TabsTrigger value="stock-movements" className="flex items-center gap-2">
            <ArrowDownUp className="h-4 w-4" />
            <span className="hidden sm:inline">Movements</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Invoices</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab />
        </TabsContent>
        <TabsContent value="purchase-orders">
          <PurchaseOrdersTab />
        </TabsContent>
        <TabsContent value="stock-movements">
          <StockMovementsTab />
        </TabsContent>
        <TabsContent value="invoices">
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Vendor Invoices — Coming in Phase 2</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Inventory;
