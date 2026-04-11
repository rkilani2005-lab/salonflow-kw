 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { useToast } from '@/hooks/use-toast';
 
 export type ClientTier = 'normal' | 'vip' | 'vvip';
 
 export interface Client {
   id: string;
   name: string;
   phone: string;
   email: string | null;
   notes: string | null;
   tier: ClientTier;
   tenant_id: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export interface ClientWithStats extends Client {
   total_visits: number;
   total_spent: number;
   last_visit: string | null;
 }
 
 export const useClients = (searchQuery?: string) => {
   const { tenant } = useAuth();
 
   return useQuery({
     queryKey: ['clients', tenant?.id, searchQuery],
     queryFn: async () => {
       let query = supabase
         .from('clients')
          .select('id, name, phone, email, tier, notes, created_at, updated_at, tenant_id')
         .order('created_at', { ascending: false });
 
       if (searchQuery && searchQuery.trim()) {
         query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as Client[];
     },
     enabled: !!tenant?.id,
   });
 };
 
 export const useClientWithStats = (clientId: string | null) => {
   return useQuery({
     queryKey: ['client', clientId],
     queryFn: async () => {
       if (!clientId) return null;
       
       // Fetch client
       const { data: client, error: clientError } = await supabase
         .from('clients')
          .select('id, name, phone, email, tier, notes, created_at, updated_at, tenant_id')
          .eq('id', clientId)
         .single();
       
       if (clientError) throw clientError;
 
       // Fetch bookings for this client
       const { data: bookings, error: bookingsError } = await supabase
         .from('bookings')
         .select('id, service_name, service_category, booking_date, start_time, end_time, status, price, notes, staff_id, created_at')
         .eq('client_id', clientId)
         .order('booking_date', { ascending: false });
 
       if (bookingsError) throw bookingsError;
 
       const completedBookings = bookings?.filter(b => b.status === 'completed') || [];
       
       return {
         ...client,
         total_visits: completedBookings.length,
         total_spent: completedBookings.reduce((sum, b) => sum + Number(b.price), 0),
         last_visit: completedBookings[0]?.booking_date || null,
         bookings: bookings || [],
       } as ClientWithStats & { bookings: any[] };
     },
     enabled: !!clientId,
   });
 };
 
 export const useCreateClient = () => {
   const queryClient = useQueryClient();
   const { tenant } = useAuth();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (data: { name: string; phone: string; email?: string; notes?: string; tier?: ClientTier }) => {
       const { data: client, error } = await supabase
         .from('clients')
         .insert({
           ...data,
           tenant_id: tenant?.id,
           tier: data.tier || 'normal',
         })
         .select()
         .single();
 
       if (error) throw error;
       return client;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['clients'] });
       toast({ title: 'Client created successfully' });
     },
     onError: (error) => {
       toast({ title: 'Failed to create client', description: error.message, variant: 'destructive' });
     },
   });
 };
 
 export const useUpdateClient = () => {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ id, ...data }: Partial<Client> & { id: string }) => {
       const { data: client, error } = await supabase
         .from('clients')
         .update({ ...data, updated_at: new Date().toISOString() })
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return client;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['clients'] });
       queryClient.invalidateQueries({ queryKey: ['client'] });
       toast({ title: 'Client updated successfully' });
     },
     onError: (error) => {
       toast({ title: 'Failed to update client', description: error.message, variant: 'destructive' });
     },
   });
 };