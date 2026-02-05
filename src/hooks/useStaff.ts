 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { useToast } from '@/hooks/use-toast';
 import type { Tables } from '@/integrations/supabase/types';
 
 export type Staff = Tables<'staff'> & { tenant_id: string | null };
 export type Service = Tables<'services'>;
 
 export interface StaffWithServices extends Staff {
   services: Service[];
 }
 
 export const useStaff = (searchQuery?: string) => {
   const { tenant } = useAuth();
 
   return useQuery({
     queryKey: ['staff', tenant?.id, searchQuery],
     queryFn: async () => {
       let query = supabase
         .from('staff')
         .select('*')
         .order('name', { ascending: true });
 
       if (searchQuery && searchQuery.trim()) {
         query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as Staff[];
     },
     enabled: !!tenant?.id,
   });
 };
 
 export const useStaffWithServices = (staffId: string | null) => {
   return useQuery({
     queryKey: ['staff', staffId, 'services'],
     queryFn: async () => {
       if (!staffId) return null;
 
       const { data: staff, error: staffError } = await supabase
         .from('staff')
         .select('*')
         .eq('id', staffId)
         .single();
 
       if (staffError) throw staffError;
 
       const { data: staffServices, error: ssError } = await supabase
         .from('staff_services')
         .select('service_id')
         .eq('staff_id', staffId);
 
       if (ssError) throw ssError;
 
       const serviceIds = staffServices?.map(ss => ss.service_id) || [];
       let services: Service[] = [];
 
       if (serviceIds.length > 0) {
         const { data: servicesData, error: servicesError } = await supabase
           .from('services')
           .select('*')
           .in('id', serviceIds);
 
         if (servicesError) throw servicesError;
         services = servicesData || [];
       }
 
       return { ...staff, services } as StaffWithServices;
     },
     enabled: !!staffId,
   });
 };
 
 export const useServices = () => {
   const { tenant } = useAuth();
 
   return useQuery({
     queryKey: ['services', tenant?.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('services')
         .select('*')
         .order('name');
 
       if (error) throw error;
       return data as Service[];
     },
     enabled: !!tenant?.id,
   });
 };
 
 export const useCreateStaff = () => {
   const queryClient = useQueryClient();
   const { tenant } = useAuth();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (data: {
       name: string;
       name_ar?: string;
       email?: string;
       phone?: string;
       color?: string;
       working_hours_start: string;
       working_hours_end: string;
       break_start?: string;
       break_end?: string;
       serviceIds?: string[];
     }) => {
       const { serviceIds, ...staffData } = data;
 
       const { data: staff, error } = await supabase
         .from('staff')
         .insert({
           ...staffData,
           tenant_id: tenant?.id,
         })
         .select()
         .single();
 
       if (error) throw error;
 
       if (serviceIds && serviceIds.length > 0) {
         const { error: ssError } = await supabase
           .from('staff_services')
           .insert(serviceIds.map(sid => ({ staff_id: staff.id, service_id: sid })));
 
         if (ssError) throw ssError;
       }
 
       return staff;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['staff'] });
       toast({ title: 'Staff member added successfully' });
     },
     onError: (error) => {
       toast({ title: 'Failed to add staff', description: error.message, variant: 'destructive' });
     },
   });
 };
 
 export const useUpdateStaff = () => {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ id, serviceIds, ...data }: Partial<Staff> & { id: string; serviceIds?: string[] }) => {
       const { data: staff, error } = await supabase
         .from('staff')
         .update({ ...data, updated_at: new Date().toISOString() })
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
 
       if (serviceIds !== undefined) {
         await supabase.from('staff_services').delete().eq('staff_id', id);
 
         if (serviceIds.length > 0) {
           const { error: ssError } = await supabase
             .from('staff_services')
             .insert(serviceIds.map(sid => ({ staff_id: id, service_id: sid })));
 
           if (ssError) throw ssError;
         }
       }
 
       return staff;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['staff'] });
       toast({ title: 'Staff updated successfully' });
     },
     onError: (error) => {
       toast({ title: 'Failed to update staff', description: error.message, variant: 'destructive' });
     },
   });
 };