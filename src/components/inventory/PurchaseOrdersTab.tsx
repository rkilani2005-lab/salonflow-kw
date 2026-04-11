import { useState } from 'react';
import { usePurchaseOrders, PO_STATUS_CONFIG, type PurchaseOrder } from '@/hooks/usePurchaseOrders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ClipboardList, Clock } from 'lucide-react';
import { CreatePODialog } from './CreatePODialog';
import { PODetailSheet } from './PODetailSheet';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export const PurchaseOrdersTab = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const { data: orders, isLoading } = usePurchaseOrders(statusFilter);
  const { data: allOrders } = usePurchaseOrders('pending_approval');
  const pendingCount = allOrders?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(PO_STATUS_CONFIG).map(([value, config]) => (
                <SelectItem key={value} value={value}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pendingCount > 0 && (
            <button
              onClick={() => setStatusFilter('pending_approval')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-100 transition-colors">
              <Clock className="h-3.5 w-3.5" />
              {pendingCount} awaiting approval
            </button>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create PO
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">Loading...</div>
      ) : !orders?.length ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mb-3 opacity-40" />
          <p>No purchase orders found</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => (
                <TableRow
                  key={po.id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    po.status === 'pending_approval' && 'bg-amber-50/50 dark:bg-amber-950/10 border-l-2 border-l-amber-400',
                  )}
                  onClick={() => setSelectedPO(po)}>
                  <TableCell className="font-mono font-medium">{po.po_number}</TableCell>
                  <TableCell>
                    <span>{po.supplier?.name || '—'}</span>
                    {po.supplier?.name_ar && (
                      <span className="block text-xs text-muted-foreground" dir="rtl">{po.supplier.name_ar}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn('text-xs', PO_STATUS_CONFIG[po.status]?.color || '')}
                      variant="outline">
                      {po.status === 'pending_approval' && <Clock className="h-2.5 w-2.5 mr-1" />}
                      {PO_STATUS_CONFIG[po.status]?.label || po.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{po.total_amount.toFixed(3)} KWD</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(po.created_at), 'dd MMM yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreatePODialog open={createOpen} onOpenChange={setCreateOpen} />
      <PODetailSheet po={selectedPO} onClose={() => setSelectedPO(null)} />
    </div>
  );
};


  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(PO_STATUS_CONFIG).map(([value, config]) => (
                <SelectItem key={value} value={value}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create PO
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">Loading...</div>
      ) : !orders?.length ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mb-3 opacity-40" />
          <p>No purchase orders found</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => (
                <TableRow
                  key={po.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedPO(po)}
                >
                  <TableCell className="font-mono font-medium">{po.po_number}</TableCell>
                  <TableCell>
                    <div>
                      <span>{po.supplier?.name || '—'}</span>
                      {po.supplier?.name_ar && (
                        <span className="block text-xs text-muted-foreground" dir="rtl">{po.supplier.name_ar}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${PO_STATUS_CONFIG[po.status]?.color || ''}`} variant="outline">
                      {PO_STATUS_CONFIG[po.status]?.label || po.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{po.total_amount.toFixed(3)} KWD</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(po.created_at), 'dd MMM yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreatePODialog open={createOpen} onOpenChange={setCreateOpen} />
      <PODetailSheet po={selectedPO} onClose={() => setSelectedPO(null)} />
    </div>
  );
};
