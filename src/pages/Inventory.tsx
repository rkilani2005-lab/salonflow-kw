import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Truck, ClipboardList, ArrowDownUp, FileText, ClipboardCheck } from 'lucide-react';
import { ProductsTab } from '@/components/inventory/ProductsTab';
import { SuppliersTab } from '@/components/inventory/SuppliersTab';
import { StockMovementsTab } from '@/components/inventory/StockMovementsTab';
import { PurchaseOrdersTab } from '@/components/inventory/PurchaseOrdersTab';
import { VendorInvoicesTab } from '@/components/inventory/VendorInvoicesTab';
import { StockTakeTab } from '@/components/inventory/stocktake/StockTakeTab';

const Inventory = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground">Manage products, suppliers, and procurement</p>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
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
