import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts, type Product } from '@/hooks/useProducts';
import { Search, Package, ScanBarcode } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface ProductSearchProps {
  onAddProduct: (product: Product) => void;
}

export function ProductSearch({ onAddProduct }: ProductSearchProps) {
  const [search, setSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const { data: products, isLoading } = useProducts(debouncedSearch);

  // Filter to only retail/both products
  const retailProducts = products?.filter(
    (p) => (p.product_type === 'retail' || p.product_type === 'both') && p.is_active
  );

  const handleBarcodeResult = (barcode: string) => {
    setSearch(barcode);
    setShowScanner(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0"
          onClick={() => setShowScanner(!showScanner)}
        >
          <ScanBarcode className="h-5 w-5" />
        </Button>
      </div>

      {debouncedSearch && (
        <ScrollArea className="max-h-60">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-3">Searching...</p>
          ) : retailProducts && retailProducts.length > 0 ? (
            <div className="space-y-1">
              {retailProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    if (product.current_stock > 0) {
                      onAddProduct(product);
                      setSearch('');
                    }
                  }}
                  disabled={product.current_stock <= 0}
                  className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent/10 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    {product.name_ar && (
                      <p className="text-xs text-muted-foreground truncate" dir="rtl">{product.name_ar}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {product.sku && `SKU: ${product.sku} · `}
                      Stock: {product.current_stock}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {Number(product.retail_price).toFixed(3)} KWD
                    </p>
                    {product.current_stock <= 0 && (
                      <Badge variant="destructive" className="text-xs">Out of stock</Badge>
                    )}
                    {product.current_stock > 0 && product.current_stock <= (product.reorder_point || 10) && (
                      <Badge variant="secondary" className="text-xs">Low stock</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground p-3">No retail products found</p>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
