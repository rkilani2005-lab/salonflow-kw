import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  address: string | null;
  payment_terms: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export const useSuppliers = (searchQuery?: string) => {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: ['suppliers', tenant?.id, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });

      if (searchQuery?.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,name_ar.ilike.%${searchQuery}%,contact_person.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!tenant?.id,
  });
};

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<Supplier, 'id' | 'tenant_id' | 'created_at'>) => {
      const { data: supplier, error } = await supabase
        .from('suppliers')
        .insert({ ...data, tenant_id: tenant?.id } as any)
        .select()
        .single();

      if (error) throw error;
      return supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Supplier created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create supplier', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Supplier> & { id: string }) => {
      const { data: supplier, error } = await supabase
        .from('suppliers')
        .update(data as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Supplier updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update supplier', description: error.message, variant: 'destructive' });
    },
  });
};
