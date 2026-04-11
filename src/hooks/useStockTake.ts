import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type StockTakeStatus = 'open' | 'in_progress' | 'reviewing' | 'completed';
export type StockTakeScope = 'full_store' | 'retail_only' | 'professional_only' | 'category';
export type StockTakeEntryStatus = 'pending' | 'counted' | 'recounting' | 'accepted';
export type VarianceReason = 'theft' | 'broken' | 'expired' | 'data_entry_error' | 'supplier_shortage' | 'unrecorded_sale' | 'other';

export interface StockTakeSession {
  id: string;
  tenant_id: string;
  session_name: string;
  scope: StockTakeScope;
  scope_filter_id: string | null;
  status: StockTakeStatus;
  assigned_staff_ids: string[];
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  total_variance_value: number;
  created_at: string;
  updated_at: string;
}

export interface StockTakeEntry {
  id: string;
  session_id: string;
  product_id: string;
  system_quantity: number;
  counted_quantity: number | null;
  variance: number;
  unit_cost: number;
  variance_value: number;
  status: StockTakeEntryStatus;
  counted_by: string | null;
  counted_at: string | null;
  variance_reason: VarianceReason | null;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  // joined
  product?: {
    id: string;
    name: string;
    name_ar: string | null;
    sku: string | null;
    barcode: string | null;
    image_url: string | null;
    product_type: string;
    current_stock: number;
    cost_price: number;
  };
}

export const useStockTakeSessions = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['stock_take_sessions', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_take_sessions')
        .select('id, tenant_id, session_name, scope, scope_filter_id, status, created_by, assigned_staff_ids, started_at, completed_at, completed_by, notes, total_variance_value, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as StockTakeSession[];
    },
    enabled: !!tenant?.id,
  });
};

export const useStockTakeSession = (sessionId: string | null) => {
  return useQuery({
    queryKey: ['stock_take_session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('stock_take_sessions')
        .select('id, tenant_id, session_name, scope, scope_filter_id, status, created_by, assigned_staff_ids, started_at, completed_at, completed_by, notes, total_variance_value, created_at, updated_at')
        .eq('id', sessionId)
        .single();
      if (error) throw error;
      return data as StockTakeSession;
    },
    enabled: !!sessionId,
  });
};

export const useStockTakeEntries = (sessionId: string | null) => {
  return useQuery({
    queryKey: ['stock_take_entries', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('stock_take_entries')
        .select('*, product:products(id, name, name_ar, sku, barcode, image_url, product_type, current_stock, cost_price)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as StockTakeEntry[];
    },
    enabled: !!sessionId,
  });
};

export const useCreateStockTakeSession = () => {
  const queryClient = useQueryClient();
  const { tenant, user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      session_name: string;
      scope: StockTakeScope;
      scope_filter_id?: string;
      assigned_staff_ids: string[];
      notes?: string;
    }) => {
      // 1. Create the session
      const { data: session, error } = await supabase
        .from('stock_take_sessions')
        .insert({
          tenant_id: tenant!.id,
          session_name: data.session_name,
          scope: data.scope,
          scope_filter_id: data.scope_filter_id || null,
          assigned_staff_ids: data.assigned_staff_ids,
          created_by: user?.id || null,
          notes: data.notes || null,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // 2. Fetch products based on scope
      let productQuery = supabase
        .from('products')
        .select('id, current_stock, cost_price, product_type, category_id')
        .eq('is_active', true);

      if (data.scope === 'retail_only') {
        productQuery = productQuery.in('product_type', ['retail', 'both']);
      } else if (data.scope === 'professional_only') {
        productQuery = productQuery.in('product_type', ['professional', 'both']);
      } else if (data.scope === 'category' && data.scope_filter_id) {
        productQuery = productQuery.eq('category_id', data.scope_filter_id);
      }

      const { data: products, error: prodError } = await productQuery;
      if (prodError) throw prodError;

      // 3. Create entries for each product
      if (products && products.length > 0) {
        const entries = products.map(p => ({
          session_id: session.id,
          product_id: p.id,
          system_quantity: p.current_stock,
          unit_cost: p.cost_price,
        }));
        const { error: entryError } = await supabase
          .from('stock_take_entries')
          .insert(entries as any);
        if (entryError) throw entryError;
      }

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_take_sessions'] });
      toast({ title: 'Stock take session created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create session', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateSessionStatus = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: string; status: StockTakeStatus }) => {
      const updateData: any = { status };
      if (status === 'in_progress') updateData.started_at = new Date().toISOString();
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id;
      }
      const { error } = await supabase
        .from('stock_take_sessions')
        .update(updateData)
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_take_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['stock_take_session'] });
      toast({ title: 'Session status updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      entryId: string;
      counted_quantity?: number;
      status?: StockTakeEntryStatus;
      counted_by?: string;
      variance_reason?: VarianceReason;
      reviewer_notes?: string;
      reviewed_by?: string;
    }) => {
      const updateData: any = {};
      if (data.counted_quantity !== undefined) {
        updateData.counted_quantity = data.counted_quantity;
        updateData.counted_at = new Date().toISOString();
      }
      if (data.status) updateData.status = data.status;
      if (data.counted_by) updateData.counted_by = data.counted_by;
      if (data.variance_reason) updateData.variance_reason = data.variance_reason;
      if (data.reviewer_notes !== undefined) updateData.reviewer_notes = data.reviewer_notes;
      if (data.reviewed_by) {
        updateData.reviewed_by = data.reviewed_by;
        updateData.reviewed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('stock_take_entries')
        .update(updateData)
        .eq('id', data.entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_take_entries'] });
    },
  });
};

export const useCommitStockTake = () => {
  const queryClient = useQueryClient();
  const { tenant, user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      // Fetch all accepted entries
      const { data: entries, error: fetchError } = await supabase
        .from('stock_take_entries')
        .select('id, stocktake_id, product_id, expected_qty, counted_qty, variance, cost_price, notes')
        .eq('session_id', sessionId)
        .eq('status', 'accepted');
      if (fetchError) throw fetchError;

      if (!entries || entries.length === 0) {
        throw new Error('No accepted entries to commit');
      }

      // For each entry, update product stock and log transaction
      for (const entry of entries) {
        const variance = (entry as any).variance as number;
        if (variance === 0) continue;

        // Update product current_stock
        await supabase
          .from('products')
          .update({ current_stock: (entry as any).counted_quantity } as any)
          .eq('id', entry.product_id);

        // Log inventory transaction
        await supabase
          .from('inventory_transactions')
          .insert({
            tenant_id: tenant!.id,
            product_id: entry.product_id,
            transaction_type: 'adjustment' as any,
            quantity_change: variance,
            reference_type: 'stock_take',
            reference_id: sessionId,
            notes: `Stock take adjustment. Reason: ${(entry as any).variance_reason || 'N/A'}`,
            created_by: user?.id || null,
          } as any);
      }

      // Calculate total variance value
      const totalVarianceValue = entries.reduce((sum, e) => sum + Math.abs((e as any).variance_value || 0), 0);

      // Mark session as completed
      await supabase
        .from('stock_take_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          total_variance_value: totalVarianceValue,
        } as any)
        .eq('id', sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_take_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['stock_take_session'] });
      queryClient.invalidateQueries({ queryKey: ['stock_take_entries'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Stock take committed successfully. Inventory updated.' });
    },
    onError: (error) => {
      toast({ title: 'Failed to commit stock take', description: error.message, variant: 'destructive' });
    },
  });
};
