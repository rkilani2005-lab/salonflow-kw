import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ServiceRecipe {
  id: string;
  service_id: string;
  product_id: string;
  quantity_per_service: number;
  tenant_id: string;
  product?: {
    id: string;
    name: string;
    name_ar: string | null;
    usage_unit: string;
    current_stock: number;
    cost_price: number;
  };
}

export const useServiceRecipes = (serviceId: string | null) => {
  return useQuery({
    queryKey: ['service_recipes', serviceId],
    queryFn: async () => {
      if (!serviceId) return [];
      const { data, error } = await supabase
        .from('service_recipes')
        .select('*, product:products(id, name, name_ar, usage_unit, current_stock, cost_price)')
        .eq('service_id', serviceId);

      if (error) throw error;
      return (data || []) as ServiceRecipe[];
    },
    enabled: !!serviceId,
  });
};

export const useAddRecipeItem = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { service_id: string; product_id: string; quantity_per_service: number }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data: recipe, error } = await supabase
        .from('service_recipes')
        .insert({
          service_id: data.service_id,
          product_id: data.product_id,
          quantity_per_service: data.quantity_per_service,
          tenant_id: tenant.id,
        })
        .select('*, product:products(id, name, name_ar, usage_unit, current_stock, cost_price)')
        .single();

      if (error) throw error;
      return recipe;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['service_recipes', variables.service_id] });
      toast({ title: 'Product added to recipe' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add recipe item', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateRecipeItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; service_id: string; quantity_per_service: number }) => {
      const { error } = await supabase
        .from('service_recipes')
        .update({ quantity_per_service: data.quantity_per_service })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['service_recipes', variables.service_id] });
    },
    onError: (error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteRecipeItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; service_id: string }) => {
      const { error } = await supabase
        .from('service_recipes')
        .delete()
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['service_recipes', variables.service_id] });
      toast({ title: 'Product removed from recipe' });
    },
    onError: (error) => {
      toast({ title: 'Failed to remove', description: error.message, variant: 'destructive' });
    },
  });
};

/**
 * Deduct recipe products from inventory when a booking is completed.
 * Called from the POS or booking completion flow.
 */
export const useDeductRecipeStock = () => {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { service_id: string; booking_id: string }) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Fetch recipes for this service
      const { data: recipes, error: recipesError } = await supabase
        .from('service_recipes')
        .select('*, product:products(id, name, current_stock)')
        .eq('service_id', data.service_id);

      if (recipesError) throw recipesError;
      if (!recipes || recipes.length === 0) return;

      // Deduct each product
      for (const recipe of recipes) {
        const product = (recipe as any).product;
        if (!product) continue;

        const newStock = product.current_stock - recipe.quantity_per_service;

        await supabase
          .from('products')
          .update({ current_stock: newStock })
          .eq('id', recipe.product_id);

        await supabase
          .from('inventory_transactions')
          .insert({
            tenant_id: tenant.id,
            product_id: recipe.product_id,
            quantity_change: -recipe.quantity_per_service,
            transaction_type: 'service_consumption' as const,
            reference_id: data.booking_id,
            reference_type: 'booking',
            notes: `Auto-deducted for service: ${product.name}`,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      toast({ title: 'Stock deduction failed', description: error.message, variant: 'destructive' });
    },
  });
};
