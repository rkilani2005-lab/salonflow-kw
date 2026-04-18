import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownUp } from 'lucide-react';
import { format } from 'date-fns';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';

interface InventoryTransaction {
  id: string;
  product_id: string;
  transaction_type: string;
  quantity_change: number;
  reference_type: string | null;
  notes: string | null;
  created_at: string;
}

const typeColors: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  purchase_receipt: 'default',
  service_consumption: 'destructive',
  retail_sale: 'destructive',
  adjustment: 'secondary',
  wastage: 'destructive',
  return: 'outline',
};

export const StockMovementsTab = () => {
  const { tenant } = useAuth();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['inventory_transactions', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('id, product_id, transaction_type, quantity_change, reference_type, reference_id, notes, created_at, tenant_id')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as InventoryTransaction[];
    },
    enabled: !!tenant?.id,
  });

  if (isLoading) return <LoadingState variant="table" rows={8} />;

  if (!transactions?.length) {
    return (
      <EmptyState
        icon={ArrowDownUp}
        title="No stock movements yet"
        description="Movements appear automatically when you receive goods, sell retail, or consume products during services."
      />
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Qty Change</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="text-muted-foreground">
                {format(new Date(tx.created_at), 'dd MMM yyyy HH:mm')}
              </TableCell>
              <TableCell>
                <Badge variant={typeColors[tx.transaction_type] || 'secondary'} className="capitalize text-xs">
                  {tx.transaction_type.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell className={`text-right font-mono ${tx.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {tx.quantity_change > 0 ? '+' : ''}{tx.quantity_change}
              </TableCell>
              <TableCell className="text-muted-foreground">{tx.reference_type || '—'}</TableCell>
              <TableCell className="text-muted-foreground max-w-[200px] truncate">{tx.notes || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
