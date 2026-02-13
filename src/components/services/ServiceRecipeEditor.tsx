import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  useServiceRecipes,
  useAddRecipeItem,
  useUpdateRecipeItem,
  useDeleteRecipeItem,
} from '@/hooks/useServiceRecipes';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useDebounce } from '@/hooks/useDebounce';
import { Plus, Minus, Trash2, Search, Package, FlaskConical } from 'lucide-react';

interface ServiceRecipeEditorProps {
  serviceId: string;
}

export function ServiceRecipeEditor({ serviceId }: ServiceRecipeEditorProps) {
  const [productSearch, setProductSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const debouncedSearch = useDebounce(productSearch, 300);

  const { data: recipes, isLoading } = useServiceRecipes(serviceId);
  const { data: products } = useProducts(debouncedSearch);
  const addItem = useAddRecipeItem();
  const updateItem = useUpdateRecipeItem();
  const deleteItem = useDeleteRecipeItem();

  // Filter to professional/both products not already in recipe
  const recipeProductIds = new Set(recipes?.map(r => r.product_id) || []);
  const availableProducts = products?.filter(
    (p) => (p.product_type === 'professional' || p.product_type === 'both') && p.is_active && !recipeProductIds.has(p.id)
  ) || [];

  const handleAddProduct = (product: Product) => {
    addItem.mutate({
      service_id: serviceId,
      product_id: product.id,
      quantity_per_service: 1,
    });
    setProductSearch('');
    setShowSearch(false);
  };

  const handleQuantityChange = (recipeId: string, currentQty: number, delta: number) => {
    const newQty = Math.max(0.1, currentQty + delta);
    updateItem.mutate({
      id: recipeId,
      service_id: serviceId,
      quantity_per_service: Math.round(newQty * 100) / 100,
    });
  };

  const handleDelete = (recipeId: string) => {
    deleteItem.mutate({ id: recipeId, service_id: serviceId });
  };

  // Calculate total cost per service
  const totalCost = recipes?.reduce((sum, r) => {
    const cost = r.product?.cost_price || 0;
    return sum + (cost * r.quantity_per_service);
  }, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium text-foreground">Service Recipe (BOM)</h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSearch(!showSearch)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Product
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Define which products are consumed each time this service is performed. Stock will be auto-deducted on booking completion.
      </p>

      {/* Product search for adding */}
      {showSearch && (
        <div className="space-y-2 p-3 border border-border rounded-lg bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search professional products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          {debouncedSearch && (
            <ScrollArea className="max-h-40">
              {availableProducts.length > 0 ? (
                <div className="space-y-1">
                  {availableProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleAddProduct(product)}
                      className="w-full flex items-center gap-3 p-2 rounded hover:bg-accent/10 text-left transition-colors"
                    >
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.usage_unit} · Stock: {product.current_stock} · Cost: {Number(product.cost_price).toFixed(3)} KWD
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground p-2">No matching professional products found</p>
              )}
            </ScrollArea>
          )}
        </div>
      )}

      {/* Recipe items list */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading recipe...</div>
      ) : recipes && recipes.length > 0 ? (
        <div className="space-y-2">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card"
            >
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {recipe.product?.name || 'Unknown product'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {recipe.product?.usage_unit || 'Unit'} · Cost: {Number(recipe.product?.cost_price || 0).toFixed(3)} KWD
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleQuantityChange(recipe.id, recipe.quantity_per_service, -0.5)}
                  disabled={recipe.quantity_per_service <= 0.1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-12 text-center text-sm font-medium text-foreground">
                  {recipe.quantity_per_service}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleQuantityChange(recipe.id, recipe.quantity_per_service, 0.5)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right">
                {(Number(recipe.product?.cost_price || 0) * recipe.quantity_per_service).toFixed(3)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => handleDelete(recipe.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}

          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Product Cost per Service</span>
            <Badge variant="secondary">{totalCost.toFixed(3)} KWD</Badge>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-border rounded-lg">
          <FlaskConical className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No products in recipe</p>
          <p className="text-xs text-muted-foreground">Add products that are consumed when performing this service</p>
        </div>
      )}
    </div>
  );
}
