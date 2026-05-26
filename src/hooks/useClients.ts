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
 
       if (error) {
         // Translate Postgres unique-violation into a user-friendly message
         // (Postgres code 23505 = unique_violation).
         const code = (error as any).code;
         if (code === '23505') {
           const isPhone = /phone/i.test(error.message);
           throw new Error(
             isPhone
               ? 'A client with this phone number already exists. Use Find Duplicates to merge.'
               : 'A client with this email already exists. Use Find Duplicates to merge.',
           );
         }
         throw error;
       }
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
/**
 * Dedupe — find existing clients that look similar to what's being typed
 * in the New Client form. Used to suggest "this person may already exist"
 * before letting the staff create another row.
 *
 * Matches in three ways (server-side via find_similar_clients RPC):
 *   - phone : exact match on last 8 digits (robust to "+965 9988 7766"
 *             vs "+96599887766" vs "99887766")
 *   - email : case-insensitive exact match
 *   - name  : trigram similarity >= 0.3
 */
export interface SimilarClient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  match_reason: 'phone' | 'email' | 'name';
  similarity: number;
}

export const useFindSimilarClients = (args: { name?: string; phone?: string; email?: string }) => {
  const { tenant } = useAuth();
  const enabled =
    !!tenant?.id &&
    (
      (args.name?.trim().length ?? 0) >= 3 ||
      ((args.phone?.replace(/\D/g, '') ?? '').length) >= 7 ||
      ((args.email?.trim().length ?? 0) >= 4)
    );

  return useQuery({
    queryKey: ['similar-clients', tenant?.id, args.name, args.phone, args.email],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('find_similar_clients', {
        p_name:  args.name  || null,
        p_phone: args.phone || null,
        p_email: args.email || null,
        p_limit: 5,
      });
      if (error) {
        // The RPC might not exist yet on tenants where the migration
        // hasn't landed — degrade gracefully to empty list rather than
        // breaking the New Client form.
        if (error.message?.match(/find_similar_clients|function .* does not exist/i)) {
          return [] as SimilarClient[];
        }
        throw error;
      }
      return (data ?? []) as SimilarClient[];
    },
  });
};

/**
 * Merge — move all references from duplicate → primary, delete duplicate.
 * The actual work happens in the merge_clients(uuid, uuid) Postgres
 * function which runs as a single transaction so partial merges aren't
 * possible.
 */
export const useMergeClients = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (args: { primary_id: string; duplicate_id: string }) => {
      const { data, error } = await supabase.rpc('merge_clients', {
        p_primary:   args.primary_id,
        p_duplicate: args.duplicate_id,
      });
      if (error) throw error;
      return data as {
        ok: boolean;
        primary_id: string;
        merged_from: string;
        moved_bookings: number;
        moved_conversations: number;
        moved_transactions: number;
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      toast({
        title: 'Clients merged',
        description: `Moved ${result.moved_bookings} booking(s), ${result.moved_conversations} conversation(s), and ${result.moved_transactions} transaction(s).`,
      });
    },
    onError: (error: any) => {
      toast({ title: 'Merge failed', description: error.message, variant: 'destructive' });
    },
  });
};
