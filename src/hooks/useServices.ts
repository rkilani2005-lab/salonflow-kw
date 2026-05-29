 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { useToast } from '@/hooks/use-toast';
 import type { Tables, Enums } from '@/integrations/supabase/types';
 
 export type Service = Tables<'services'> & { tenant_id: string | null };
 export type ServiceCategory = Enums<'service_category'>;
 
export const SERVICE_CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: 'hair', label: 'Hair' },
  { value: 'nails', label: 'Nails' },
  { value: 'facial', label: 'Facial' },
  { value: 'makeup', label: 'Makeup' },
  { value: 'waxing', label: 'Waxing' },
  { value: 'massage', label: 'Massage' },
  { value: 'other', label: 'Other' },
];

/** GL revenue categories — these mirror the revenue source_keys in the
 *  chart of accounts (added in Phase 2). Used to route revenue lines on
 *  the journal posting side. Default is 'other'. */
export const GL_CATEGORIES: { value: string; label_en: string; label_ar: string }[] = [
  { value: 'hair',    label_en: 'Hair',    label_ar: 'شعر' },
  { value: 'nails',   label_en: 'Nails',   label_ar: 'أظافر' },
  { value: 'facial',  label_en: 'Facial',  label_ar: 'وجه' },
  { value: 'makeup',  label_en: 'Makeup',  label_ar: 'مكياج' },
  { value: 'waxing',  label_en: 'Waxing',  label_ar: 'إزالة الشعر' },
  { value: 'massage', label_en: 'Massage', label_ar: 'مساج' },
  { value: 'other',   label_en: 'Other',   label_ar: 'أخرى' },
];
 
 export const useServicesManagement = (searchQuery?: string, categoryFilter?: string) => {
   const { tenant } = useAuth();
 
   return useQuery({
     queryKey: ['services', tenant?.id, searchQuery, categoryFilter],
     queryFn: async () => {
       let query = supabase
         .from('services')
         .select('id, name, name_ar, category, duration, price, color, is_active, deposit_required, deposit_amount, tenant_id')
         .order('category', { ascending: true })
         .order('name', { ascending: true });
 
       if (searchQuery && searchQuery.trim()) {
         query = query.or(`name.ilike.%${searchQuery}%,name_ar.ilike.%${searchQuery}%`);
       }
 
       if (categoryFilter && categoryFilter !== 'all') {
         query = query.eq('category', categoryFilter as ServiceCategory);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as Service[];
     },
     enabled: !!tenant?.id,
   });
 };
 
 export const useServiceById = (serviceId: string | null) => {
   return useQuery({
     queryKey: ['service', serviceId],
     queryFn: async () => {
       if (!serviceId) return null;
 
       const { data, error } = await supabase
         .from('services')
         .select('id, name, name_ar, category, duration, price, color, is_active, deposit_required, deposit_amount, tenant_id')
         .eq('id', serviceId)
         .maybeSingle();
 
       if (error) throw error;
       return data as Service | null;
     },
     enabled: !!serviceId,
   });
 };
 
 export const useCreateService = () => {
   const queryClient = useQueryClient();
   const { tenant } = useAuth();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (data: {
       name: string;
       name_ar?: string;
       category: ServiceCategory;
       price: number;
       duration: number;
       color?: string;
       deposit_required?: boolean;
       deposit_amount?: number;
     }) => {
       const { data: service, error } = await supabase
         .from('services')
         .insert({
           ...data,
           tenant_id: tenant?.id,
         })
         .select()
         .single();
 
       if (error) throw error;
       return service;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['services'] });
       toast({ title: 'Service created successfully' });
     },
     onError: (error) => {
       toast({ title: 'Failed to create service', description: error.message, variant: 'destructive' });
     },
   });
 };
 
 export const useUpdateService = () => {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ id, ...data }: Partial<Service> & { id: string }) => {
       const { data: service, error } = await supabase
         .from('services')
         .update({ ...data, updated_at: new Date().toISOString() })
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return service;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['services'] });
       queryClient.invalidateQueries({ queryKey: ['service'] });
       toast({ title: 'Service updated successfully' });
     },
     onError: (error) => {
       toast({ title: 'Failed to update service', description: error.message, variant: 'destructive' });
     },
   });
 };