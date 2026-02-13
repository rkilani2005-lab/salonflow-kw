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
            <p className="text-muted-foreground text-sm py-4 text-center">Loading...</p>
          ) : !receipts || receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <PackageCheck className="h-12 w-12 mb-3 opacity-40" />
              <p>No goods receipts yet</p>
              <p className="text-xs mt-1">Receive goods against approved Purchase Orders</p>
            </div>
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
