import { useState } from 'react';
import { useProducts, PRODUCT_TYPES, type Product } from '@/hooks/useProducts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Package } from 'lucide-react';
import { AddProductDialog } from './AddProductDialog';
import { ProductDetailSheet } from './ProductDetailSheet';
import { useDebounce } from '@/hooks/useDebounce';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';

const getStockLevelColor = (current: number, reorderPoint: number) => {
  if (current <= reorderPoint) return 'destructive';
  if (current <= reorderPoint * 2) return 'secondary';
  return 'default';
};

const getStockLevelText = (current: number, reorderPoint: number) => {
  if (current <= reorderPoint) return 'Critical';
  if (current <= reorderPoint * 2) return 'Low';
  return 'Good';
};

const typeBadgeVariant = (type: string) => {
  switch (type) {
    case 'professional': return 'outline';
    case 'retail': return 'default';
    default: return 'secondary';
  }
};

export const ProductsTab = () => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const { data: products, isLoading } = useProducts(debouncedSearch, typeFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {PRODUCT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {isLoading ? (
        <LoadingState variant="table" rows={6} />
      ) : !products?.length ? (
        <EmptyState
          icon={Package}
          title={search || typeFilter !== 'all' ? 'No products match your filter' : 'No products yet'}
          description={
            search || typeFilter !== 'all'
              ? 'Try adjusting the search or type filter above.'
              : 'Add your first product to start tracking inventory, costs, and stock levels.'
          }
          action={
            search || typeFilter !== 'all'
              ? { label: 'Clear filters', onClick: () => { setSearch(''); setTypeFilter('all'); } }
              : { label: 'Add Product', onClick: () => setAddOpen(true) }
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Retail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                >
                  <TableCell>
                    <div>
                      <span className="font-medium">{product.name}</span>
                      {product.name_ar && (
                        <span className="block text-xs text-muted-foreground" dir="rtl">{product.name_ar}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.sku || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={typeBadgeVariant(product.product_type)} className="capitalize text-xs">
                      {product.product_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {product.current_stock} {product.usage_unit}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStockLevelColor(product.current_stock, product.reorder_point)} className="text-xs">
                      {getStockLevelText(product.current_stock, product.reorder_point)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{product.cost_price.toFixed(3)}</TableCell>
                  <TableCell className="text-right font-mono">{product.retail_price.toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddProductDialog open={addOpen} onOpenChange={setAddOpen} />
      <ProductDetailSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </div>
  );
};
