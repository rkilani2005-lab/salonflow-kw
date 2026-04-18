import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Atomic-ish stock decrement with optimistic concurrency.
 *
 * The POS mutation previously used read-then-write, which races under
 * concurrent sales: two terminals both read stock=10, both write 10-3=7,
 * actual stock becomes 7 when it should be 4.
 *
 * We emulate atomicity via conditional update (.eq on the value we just
 * read), retrying if another writer won the race.  After MAX_RETRIES
 * attempts we surface the failure to the caller.
 *
 * Returns:
 *   - ok: update succeeded
 *   - wentNegative: deduction was larger than available stock; we still
 *     wrote (we don't block sales) but the product may now be negative.
 *     Callers should surface a cashier warning.
 *   - failed: retries exhausted — inventory is out of sync; caller
 *     should log and alert.
 */
interface StockDecrementResult {
  ok: boolean;
  wentNegative: boolean;
  failed: boolean;
  productName?: string;
}

async function safeDecrementStock(
  productId: string,
  deductQty: number,
  MAX_RETRIES = 4,
): Promise<StockDecrementResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: product, error: readErr } = await supabase
      .from('products')
      .select('current_stock, name')
      .eq('id', productId)
      .single();

    if (readErr || !product) {
      return { ok: false, wentNegative: false, failed: true };
    }

    const oldStock = Number(product.current_stock);
    const newStock = oldStock - deductQty;
    const wentNegative = newStock < 0;

    const { error: updErr, count } = await supabase
      .from('products')
      .update({ current_stock: newStock })
      .eq('id', productId)
      .eq('current_stock', oldStock) // optimistic guard
      .select('*', { count: 'exact', head: true });

    // If the guarded update affected a row, we won the race.  If count is 0,
    // another writer updated current_stock between our read and write.
    if (!updErr && (count ?? 1) > 0) {
      return { ok: true, wentNegative, failed: false, productName: product.name };
    }
    // loop and retry
  }
  return { ok: false, wentNegative: false, failed: true };
}

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

      // Collected warnings surfaced to the cashier after the sale closes,
      // so a race / negative-stock / missing-recipe-product condition is
      // never silent — the cashier gets a toast so they can investigate.
      const stockWarnings: string[] = [];

      // 4. Deduct product stock + log inventory transactions (atomic-ish)
      const productItems = input.items.filter(i => i.item_type === 'product');
      for (const item of productItems) {
        const result = await safeDecrementStock(item.item_id, item.quantity);
        if (result.failed) {
          stockWarnings.push(
            `Stock update failed for ${item.item_name} — inventory may be out of sync. Manager review needed.`
          );
          continue;
        }
        if (result.wentNegative) {
          stockWarnings.push(
            `${item.item_name}: stock went negative. Receive more stock or investigate.`
          );
        }
        const { error: invErr } = await supabase
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
        if (invErr) {
          stockWarnings.push(`Audit log failed for ${item.item_name}.`);
        }
      }

      // 5. Deduct recipe products for service items (BOM auto-deduction)
      const serviceItems = input.items.filter(i => i.item_type === 'service');
      for (const item of serviceItems) {
        const { data: recipes } = await supabase
          .from('service_recipes')
          .select('product_id, quantity_per_service, product:products(id, name)')
          .eq('service_id', item.item_id);

        if (!recipes?.length) continue;
        for (const recipe of recipes) {
          const product: any = (recipe as any).product;
          const productName = product?.name ?? 'recipe product';
          if (!recipe.product_id) {
            stockWarnings.push(
              `${item.item_name}: recipe row has no product — deduction skipped. Manager review needed.`
            );
            continue;
          }
          const deductQty = Number(recipe.quantity_per_service) * item.quantity;
          const result = await safeDecrementStock(recipe.product_id, deductQty);
          if (result.failed) {
            stockWarnings.push(
              `BOM stock update failed for ${productName} (used by ${item.item_name}) — manager review needed.`
            );
            continue;
          }
          if (result.wentNegative) {
            stockWarnings.push(
              `${productName} (used by ${item.item_name}): stock went negative.`
            );
          }
          const { error: invErr } = await supabase
            .from('inventory_transactions')
            .insert({
              tenant_id: tenant.id,
              product_id: recipe.product_id,
              quantity_change: -deductQty,
              transaction_type: 'service_consumption' as const,
              reference_id: txn.id,
              reference_type: 'pos_transaction',
              notes: `Service recipe deduction - ${productName}`,
            });
          if (invErr) {
            stockWarnings.push(`Audit log failed for ${productName}.`);
          }
        }
      }

      // Stash the warnings on the returned object so the caller's
      // onSuccess can surface them.  The txn stays the primary return.
      (txn as any).__stockWarnings = stockWarnings;

      // 6. Mark linked booking as completed
      if (input.booking_id) {
        await supabase
          .from('bookings')
          .update({ status: 'completed' as const })
          .eq('id', input.booking_id);
      }

      // 7. Calculate and record staff commissions for service items.
      //    HISTORICAL BUG: the old query selected non-existent columns
      //    (type, amount, payment_method, reference, notes, …) on
      //    staff_commission_rules.  That table's actual columns are
      //    commission_type and commission_value.  The query errored
      //    silently, rule was always undefined, and NO commission
      //    earnings row has ever been recorded for any sale.  The UI
      //    showed commission rules being configured but the earnings
      //    side was dark.
      //
      //    Fix: use the get_commission_rate RPC provisioned in
      //    20260325000001_sprint1_commissions.sql, which returns the
      //    category-specific rule if one exists, otherwise the default
      //    (NULL service_category).  Error now propagates to the
      //    stock-warnings array so cashiers see when a commission
      //    couldn't be recorded.
      const serviceItemsForCommission = input.items.filter(
        i => i.item_type === 'service' && i.staff_commission_id
      );
      for (const item of serviceItemsForCommission) {
        const staffId = item.staff_commission_id!;
        // Resolve category — prefer DB truth over whatever the cart held.
        let category = 'other';
        if (item.item_id) {
          const { data: svc } = await supabase
            .from('services').select('category').eq('id', item.item_id).single();
          if (svc?.category) category = svc.category as string;
        }

        // Resolve the applicable commission rule.  Category-specific
        // takes precedence; if none, the NULL-category default applies.
        const { data: ruleRows, error: ruleErr } = await supabase
          .rpc('get_commission_rate' as any, {
            p_staff_id: staffId,
            p_category: category,
          } as any);
        if (ruleErr) {
          stockWarnings.push(`Commission lookup failed for ${item.item_name}.`);
          continue;
        }
        const rule = (ruleRows as any[])?.[0];
        if (!rule) continue; // No rule = no commission owed; normal case.

        const rate = Number(rule.commission_value || 0);
        const commissionAmt = rule.commission_type === 'percentage'
          ? Math.round(Number(item.total_price) * (rate / 100) * 1000) / 1000
          : rate;

        if (commissionAmt <= 0) continue;

        // Try to locate the matching transaction_item_id so the earning
        // row can be precisely linked (useful for partial refund logic).
        const { data: txnItem } = await supabase
          .from('transaction_items')
          .select('id')
          .eq('transaction_id', txn.id)
          .eq('item_id', item.item_id!)
          .eq('staff_commission_id', staffId)
          .maybeSingle();

        const { error: earnErr } = await supabase
          .from('staff_commission_earnings')
          .insert({
            tenant_id:            tenant.id,
            staff_id:             staffId,
            transaction_id:       txn.id,
            transaction_item_id:  txnItem?.id ?? null,
            rule_id:              rule.rule_id,
            service_name:         item.item_name,
            sale_amount:          Number(item.total_price),
            commission_type:      rule.commission_type,
            commission_rate:      rate,
            commission_amount:    commissionAmt,
            payout_status:        'pending',
          });
        if (earnErr) {
          stockWarnings.push(`Commission record failed for ${item.item_name}: ${earnErr.message}`);
        }
      }

      return txn;
    },
    onSuccess: (txn: any) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Transaction completed successfully' });

      // Surface any stock / BOM warnings collected during the mutation
      // so the cashier isn't blind to silent inventory drift.  One
      // consolidated toast so we don't spam.
      const warnings: string[] = txn?.__stockWarnings || [];
      if (warnings.length) {
        toast({
          title: 'Inventory warnings',
          description: warnings.slice(0, 3).join('\n') + (warnings.length > 3 ? `\n…and ${warnings.length - 3} more` : ''),
          variant: 'destructive',
        });
      }
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
