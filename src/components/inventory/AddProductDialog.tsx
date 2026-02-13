import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateProduct, PRODUCT_TYPES, useProductCategories } from '@/hooks/useProducts';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  name_ar: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  product_type: z.enum(['professional', 'retail', 'both']),
  category_id: z.string().optional(),
  description: z.string().optional(),
  purchase_unit: z.string().default('Unit'),
  purchase_unit_quantity: z.coerce.number().min(1).default(1),
  usage_unit: z.string().default('Unit'),
  cost_price: z.coerce.number().min(0).default(0),
  retail_price: z.coerce.number().min(0).default(0),
  reorder_point: z.coerce.number().min(0).default(10),
  reorder_quantity: z.coerce.number().min(0).default(20),
  current_stock: z.coerce.number().min(0).default(0),
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddProductDialog = ({ open, onOpenChange }: Props) => {
  const createProduct = useCreateProduct();
  const { data: categories } = useProductCategories();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      product_type: 'professional',
      purchase_unit: 'Unit',
      purchase_unit_quantity: 1,
      usage_unit: 'Unit',
      cost_price: 0,
      retail_price: 0,
      reorder_point: 10,
      reorder_quantity: 20,
      current_stock: 0,
    },
  });

  const onSubmit = async (data: FormData) => {
    await createProduct.mutateAsync({
      name: data.name,
      name_ar: data.name_ar || null,
      sku: data.sku || null,
      barcode: data.barcode || null,
      product_type: data.product_type,
      category_id: data.category_id || null,
      description: data.description || null,
      purchase_unit: data.purchase_unit,
      purchase_unit_quantity: data.purchase_unit_quantity,
      usage_unit: data.usage_unit,
      cost_price: data.cost_price,
      retail_price: data.retail_price,
      reorder_point: data.reorder_point,
      reorder_quantity: data.reorder_quantity,
      current_stock: data.current_stock,
      batch_number: data.batch_number || null,
      expiry_date: data.expiry_date || null,
      image_url: null,
      is_active: true,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name_ar" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (Arabic)</FormLabel>
                  <FormControl><Input {...field} dir="rtl" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="product_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PRODUCT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sku" render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea {...field} rows={2} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="purchase_unit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Unit</FormLabel>
                  <FormControl><Input placeholder="e.g. Case, Gallon" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="purchase_unit_quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Qty per Purchase Unit</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="usage_unit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Usage Unit</FormLabel>
                  <FormControl><Input placeholder="e.g. Bottle, ml" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cost_price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost Price (KWD)</FormLabel>
                  <FormControl><Input type="number" step="0.001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="retail_price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Retail Price (KWD)</FormLabel>
                  <FormControl><Input type="number" step="0.001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="current_stock" render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening Stock</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reorder_point" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Point</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reorder_quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Quantity</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="batch_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch Number</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="expiry_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createProduct.isPending}>
                {createProduct.isPending ? 'Saving...' : 'Add Product'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
