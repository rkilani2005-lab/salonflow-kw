import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownUp } from 'lucide-react';
import { format } from 'date-fns';

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
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as InventoryTransaction[];
    },
    enabled: !!tenant?.id,
  });

  if (isLoading) return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading...</div>;

  if (!transactions?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <ArrowDownUp className="h-12 w-12 mb-3 opacity-40" />
        <p>No stock movements yet</p>
      </div>
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
