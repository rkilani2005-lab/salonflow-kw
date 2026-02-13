import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface CartItem {
  item_type: 'service' | 'product';
  item_id: string;
  item_name: string;
  item_name_ar?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  staff_commission_id?: string;
  current_stock?: number; // for products only
}

export interface PaymentEntry {
  payment_method: 'cash' | 'knet' | 'credit_card' | 'gift_card';
  amount: number;
}

export interface CreateTransactionInput {
  client_id?: string | null;
  staff_id?: string | null;
  booking_id?: string | null;
  items: CartItem[];
  payments: PaymentEntry[];
  subtotal: number;
  discount_type?: string | null;
  discount_value?: number;
  discount_amount?: number;
  discount_reason?: string;
  discount_approved_by?: string | null;
  tax_amount: number;
  tip_amount: number;
  grand_total: number;
  notes?: string;
}

export const useTransactions = () => {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: ['transactions', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_items(*), transaction_payments(*)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });
};

export const useTransactionById = (id: string | null) => {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_items(*), transaction_payments(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      // 1. Create the transaction header
      const { data: txn, error: txnError } = await supabase
        .from('transactions')
        .insert({
          tenant_id: tenant.id,
          client_id: input.client_id || null,
          staff_id: input.staff_id || null,
          booking_id: input.booking_id || null,
          subtotal: input.subtotal,
          discount_type: input.discount_type || null,
          discount_value: input.discount_value || 0,
          discount_amount: input.discount_amount || 0,
          discount_reason: input.discount_reason || null,
          discount_approved_by: input.discount_approved_by || null,
          tax_amount: input.tax_amount,
          tip_amount: input.tip_amount,
          grand_total: input.grand_total,
          notes: input.notes || null,
          status: 'completed' as const,
        })
        .select()
        .single();

      if (txnError) throw txnError;

      // 2. Insert line items
      const items = input.items.map(item => ({
        transaction_id: txn.id,
        item_type: item.item_type,
        item_id: item.item_id,
        item_name: item.item_name,
        item_name_ar: item.item_name_ar || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        staff_commission_id: item.staff_commission_id || null,
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // 3. Insert payments
      const payments = input.payments.map(p => ({
        transaction_id: txn.id,
        payment_method: p.payment_method,
        amount: p.amount,
      }));

      const { error: paymentsError } = await supabase
        .from('transaction_payments')
        .insert(payments);

      if (paymentsError) throw paymentsError;

      // 4. Deduct product stock + log inventory transactions
      const productItems = input.items.filter(i => i.item_type === 'product');
      for (const item of productItems) {
        const { data: product } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.item_id)
          .single();

        if (product) {
          await supabase
            .from('products')
            .update({ current_stock: product.current_stock - item.quantity })
            .eq('id', item.item_id);

          await supabase
            .from('inventory_transactions')
            .insert({
              tenant_id: tenant.id,
              product_id: item.item_id,
              quantity_change: -item.quantity,
              transaction_type: 'retail_sale' as const,
              reference_id: txn.id,
              reference_type: 'pos_transaction',
              notes: `POS sale - ${item.item_name}`,
            });
        }
      }

      // 5. Mark linked booking as completed
      if (input.booking_id) {
        await supabase
          .from('bookings')
          .update({ status: 'completed' as const })
          .eq('id', input.booking_id);
      }

      return txn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Transaction completed successfully' });
    },
    onError: (error) => {
      toast({
        title: 'Transaction failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
