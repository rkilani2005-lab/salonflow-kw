import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';

interface Props {
  productId: string;
  tenantId: string;
}

const typeLabels: Record<string, { label: string; direction: 'in' | 'out' | 'neutral' }> = {
  purchase_receipt: { label: 'Purchase Receipt', direction: 'in' },
  service_consumption: { label: 'Service Usage', direction: 'out' },
  retail_sale: { label: 'Retail Sale', direction: 'out' },
  adjustment: { label: 'Adjustment', direction: 'neutral' },
  wastage: { label: 'Wastage', direction: 'out' },
  return: { label: 'Return', direction: 'in' },
};

export const ProductStockHistory = ({ productId, tenantId }: Props) => {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['product-stock-history', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('id, product_id, transaction_type, quantity_change, reference_type, reference_id, notes, created_at, tenant_id')
        .eq('product_id', productId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!productId && !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No stock movements recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {transactions.map((tx) => {
        const meta = typeLabels[tx.transaction_type] || { label: tx.transaction_type, direction: 'neutral' };
        const isPositive = tx.quantity_change > 0;

        return (
          <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <div className="shrink-0">
            {isPositive ? (
                <ArrowUpCircle className="h-5 w-5 text-primary" />
              ) : (
                <ArrowDownCircle className="h-5 w-5 text-destructive" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{meta.label}</span>
                <Badge variant="outline" className="text-xs">
                  {isPositive ? '+' : ''}{Number(tx.quantity_change)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                {tx.notes && ` · ${tx.notes}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
