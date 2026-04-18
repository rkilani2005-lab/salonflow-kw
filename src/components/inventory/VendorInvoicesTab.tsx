import { useState } from 'react';
import { useVendorInvoices, INVOICE_STATUS_CONFIG, type VendorInvoice } from '@/hooks/useVendorInvoices';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, AlertTriangle } from 'lucide-react';
import { CreateInvoiceDialog } from './CreateInvoiceDialog';
import { InvoiceDetailSheet } from './InvoiceDetailSheet';
import { format, isPast, parseISO } from 'date-fns';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';

export const VendorInvoicesTab = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<VendorInvoice | null>(null);
  const { data: invoices, isLoading } = useVendorInvoices(statusFilter);

  // Count overdue invoices
  const overdueCount = invoices?.filter(
    (inv) => inv.status !== 'paid' && isPast(parseISO(inv.due_date))
  ).length || 0;

  return (
    <div className="space-y-4">
      {/* Overdue warning banner */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">{overdueCount} overdue invoice{overdueCount > 1 ? 's' : ''} require attention</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(INVOICE_STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {isLoading ? (
        <LoadingState variant="table" rows={5} />
      ) : !invoices?.length ? (
        <EmptyState
          icon={FileText}
          title={statusFilter !== 'all' ? 'No invoices in this status' : 'No vendor invoices yet'}
          description={
            statusFilter !== 'all'
              ? 'Try switching to "All Statuses" or record a new invoice.'
              : 'Record supplier invoices to track amounts owed, due dates, and AP aging.'
          }
          action={
            statusFilter !== 'all'
              ? { label: 'Show all', onClick: () => setStatusFilter('all') }
              : { label: 'Create Invoice', onClick: () => setCreateOpen(true) }
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const balance = inv.total_amount - inv.paid_amount;
                const isOverdue = inv.status !== 'paid' && isPast(parseISO(inv.due_date));
                return (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.supplier?.name || '—'}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {inv.purchase_order?.po_number || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${isOverdue && inv.status !== 'overdue' ? INVOICE_STATUS_CONFIG.overdue.color : INVOICE_STATUS_CONFIG[inv.status]?.color || ''}`} variant="outline">
                        {isOverdue && inv.status !== 'overdue' ? 'Overdue' : INVOICE_STATUS_CONFIG[inv.status]?.label || inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{inv.total_amount.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono">{inv.paid_amount.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {balance > 0 ? balance.toFixed(3) : '0.000'}
                    </TableCell>
                    <TableCell className={`text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {format(parseISO(inv.due_date), 'dd MMM yyyy')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <InvoiceDetailSheet invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </div>
  );
};
