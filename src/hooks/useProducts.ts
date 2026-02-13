import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Product {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  name_ar: string | null;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  product_type: 'professional' | 'retail' | 'both';
  purchase_unit: string;
  purchase_unit_quantity: number;
  usage_unit: string;
  cost_price: number;
  retail_price: number;
  reorder_point: number;
  reorder_quantity: number;
  current_stock: number;
  batch_number: string | null;
  expiry_date: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export const PRODUCT_TYPES = [
  { value: 'professional' as const, label: 'Professional / Back Bar' },
  { value: 'retail' as const, label: 'Retail / POS' },
  { value: 'both' as const, label: 'Both' },
];

export const useProducts = (searchQuery?: string, typeFilter?: string) => {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: ['products', tenant?.id, searchQuery, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (searchQuery?.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,name_ar.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%`);
      }

      if (typeFilter && typeFilter !== 'all') {
        query = query.eq('product_type', typeFilter as 'professional' | 'retail' | 'both');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!tenant?.id,
  });
};

export const useProductCategories = () => {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: ['product_categories', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as ProductCategory[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<Product, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      const { data: product, error } = await supabase
        .from('products')
        .insert({ ...data, tenant_id: tenant?.id } as any)
        .select()
        .single();

      if (error) throw error;
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create product', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Product> & { id: string }) => {
      const { data: product, error } = await supabase
        .from('products')
        .update(data as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update product', description: error.message, variant: 'destructive' });
    },
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; name_ar?: string }) => {
      const { data: category, error } = await supabase
        .from('product_categories')
        .insert({ ...data, tenant_id: tenant?.id } as any)
        .select()
        .single();

      if (error) throw error;
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_categories'] });
      toast({ title: 'Category created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create category', description: error.message, variant: 'destructive' });
    },
  });
};
