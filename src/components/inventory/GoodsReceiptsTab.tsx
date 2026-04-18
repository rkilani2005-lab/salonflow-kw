import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, PackageCheck, Eye } from 'lucide-react';
import { useGoodsReceipts, GoodsReceipt } from '@/hooks/useGoodsReceipts';
import { useAuth } from '@/contexts/AuthContext';
import { CreateGoodsReceiptDialog } from './CreateGoodsReceiptDialog';
import { GoodsReceiptDetailSheet } from './GoodsReceiptDetailSheet';
import { format } from 'date-fns';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';

export const GoodsReceiptsTab = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGR, setSelectedGR] = useState<GoodsReceipt | null>(null);
  const { data: receipts, isLoading } = useGoodsReceipts();
  const { hasRole } = useAuth();

  const canReceive = hasRole('owner') || hasRole('manager') || hasRole('inventory_clerk');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Goods Receipts</CardTitle>
          {canReceive && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Receive Goods
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState variant="table" rows={4} />
          ) : !receipts || receipts.length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              size="compact"
              title="No goods receipts yet"
              description="Receive goods against approved Purchase Orders to keep stock and GL in sync."
              action={canReceive ? { label: 'Receive Goods', onClick: () => setShowCreate(true) } : undefined}
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GRN #</TableHead>
                    <TableHead>PO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map(gr => (
                    <TableRow key={gr.id}>
                      <TableCell className="font-medium">{gr.grn_number}</TableCell>
                      <TableCell>{gr.purchase_order?.po_number || '—'}</TableCell>
                      <TableCell>
                        {gr.purchase_order?.supplier?.name || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(gr.received_at), 'dd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedGR(gr)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateGoodsReceiptDialog open={showCreate} onOpenChange={setShowCreate} />
      <GoodsReceiptDetailSheet receipt={selectedGR} onClose={() => setSelectedGR(null)} />
    </div>
  );
};
