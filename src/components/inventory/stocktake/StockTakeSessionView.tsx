import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ArrowLeft, CheckCircle2, RotateCcw, Lock, FileDown } from 'lucide-react';
import {
  useStockTakeSession,
  useStockTakeEntries,
  useUpdateEntry,
  useUpdateSessionStatus,
  useCommitStockTake,
  VarianceReason,
  StockTakeEntryStatus,
} from '@/hooks/useStockTake';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Props {
  sessionId: string;
  onBack: () => void;
}

const REASON_OPTIONS: { value: VarianceReason; label: string }[] = [
  { value: 'theft', label: 'Theft / سرقة' },
  { value: 'broken', label: 'Broken / مكسور' },
  { value: 'expired', label: 'Expired / منتهي' },
  { value: 'data_entry_error', label: 'Data Entry Error / خطأ إدخال' },
  { value: 'supplier_shortage', label: 'Supplier Shortage / نقص مورد' },
  { value: 'unrecorded_sale', label: 'Unrecorded Sale / بيع غير مسجل' },
  { value: 'other', label: 'Other / أخرى' },
];

export const StockTakeSessionView = ({ sessionId, onBack }: Props) => {
  const { data: session } = useStockTakeSession(sessionId);
  const { data: entries, isLoading } = useStockTakeEntries(sessionId);
  const updateEntry = useUpdateEntry();
  const updateStatus = useUpdateSessionStatus();
  const commitStockTake = useCommitStockTake();
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | 'variance' | 'pending'>('all');

  const filteredEntries = entries?.filter(e => {
    if (filter === 'variance') return e.variance !== 0 && e.status === 'counted';
    if (filter === 'pending') return e.status === 'pending' || e.status === 'recounting';
    return true;
  });

  const totalItems = entries?.length || 0;
  const countedItems = entries?.filter(e => e.status !== 'pending').length || 0;
  const acceptedItems = entries?.filter(e => e.status === 'accepted').length || 0;
  const totalVarianceValue = entries?.reduce((sum, e) => sum + (e.variance_value || 0), 0) || 0;
  const missingValue = entries?.reduce((sum, e) => e.variance < 0 ? sum + e.variance_value : sum, 0) || 0;
  const surplusValue = entries?.reduce((sum, e) => e.variance > 0 ? sum + e.variance_value : sum, 0) || 0;

  const handleAccept = async (entryId: string, reason?: VarianceReason) => {
    await updateEntry.mutateAsync({
      entryId,
      status: 'accepted',
      variance_reason: reason,
      reviewed_by: user?.id,
    });
  };

  const handleRecount = async (entryId: string) => {
    await updateEntry.mutateAsync({
      entryId,
      status: 'recounting',
      reviewed_by: user?.id,
      reviewer_notes: 'Recount requested',
    });
    toast({ title: 'Recount requested' });
  };

  const handleMoveToReview = async () => {
    await updateStatus.mutateAsync({ sessionId, status: 'reviewing' });
  };

  const handleCommit = async () => {
    const unreviewed = entries?.filter(e => e.status === 'counted' && e.variance !== 0);
    if (unreviewed && unreviewed.length > 0) {
      toast({ title: `${unreviewed.length} items with variance still need review`, variant: 'destructive' });
      return;
    }
    // Auto-accept zero-variance counted items
    const zeroVariance = entries?.filter(e => e.status === 'counted' && e.variance === 0);
    if (zeroVariance) {
      for (const e of zeroVariance) {
        await updateEntry.mutateAsync({ entryId: e.id, status: 'accepted', reviewed_by: user?.id });
      }
    }
    await commitStockTake.mutateAsync(sessionId);
  };

  const generateReport = () => {
    if (!entries || !session) return;
    const reportHtml = `
      <html><head><title>Stock Take Report - ${session.session_name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; direction: ltr; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; }
        .red { color: #dc2626; } .blue { color: #2563eb; } .green { color: #16a34a; }
        h1 { font-size: 20px; } .summary { display: flex; gap: 20px; margin: 16px 0; }
        .summary-card { border: 1px solid #ddd; padding: 12px; border-radius: 8px; flex: 1; }
      </style></head><body>
      <h1>📋 Stock Take Report</h1>
      <p><strong>Session:</strong> ${session.session_name}</p>
      <p><strong>Scope:</strong> ${session.scope.replace('_', ' ')}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <div class="summary">
        <div class="summary-card"><strong>Total Items:</strong> ${totalItems}</div>
        <div class="summary-card red"><strong>Missing Value:</strong> ${missingValue.toFixed(2)} KWD</div>
        <div class="summary-card blue"><strong>Surplus Value:</strong> ${surplusValue.toFixed(2)} KWD</div>
        <div class="summary-card"><strong>Net Variance:</strong> ${totalVarianceValue.toFixed(2)} KWD</div>
      </div>
      <table>
        <tr><th>Product</th><th>System Qty</th><th>Counted Qty</th><th>Variance</th><th>Unit Cost</th><th>Variance Value</th><th>Reason</th></tr>
        ${entries.filter(e => e.variance !== 0).map(e => `
          <tr>
            <td>${e.product?.name || ''}${e.product?.name_ar ? ' / ' + e.product.name_ar : ''}</td>
            <td>${e.system_quantity}</td>
            <td>${e.counted_quantity ?? '—'}</td>
            <td class="${e.variance < 0 ? 'red' : e.variance > 0 ? 'blue' : 'green'}">${e.variance}</td>
            <td>${e.unit_cost.toFixed(2)}</td>
            <td class="${e.variance_value < 0 ? 'red' : 'blue'}">${e.variance_value.toFixed(2)}</td>
            <td>${e.variance_reason || '—'}</td>
          </tr>
        `).join('')}
      </table>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(reportHtml);
      w.document.close();
    }
  };

  const isCompleted = session?.status === 'completed';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" aria-label="Go back" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{session?.session_name}</h2>
          <p className="text-sm text-muted-foreground capitalize">{session?.status?.replace('_', ' ')}</p>
        </div>
        {!isCompleted && (
          <>
            {session?.status === 'in_progress' && (
              <Button size="sm" variant="secondary" onClick={handleMoveToReview}>
                Move to Review
              </Button>
            )}
            {(session?.status === 'reviewing' || session?.status === 'in_progress') && (
              <Button size="sm" onClick={handleCommit} disabled={commitStockTake.isPending}>
                <Lock className="h-4 w-4 mr-1" />
                {commitStockTake.isPending ? 'Committing...' : 'Commit & Close'}
              </Button>
            )}
          </>
        )}
        <Button size="sm" variant="outline" onClick={generateReport}>
          <FileDown className="h-4 w-4 mr-1" /> Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{countedItems}/{totalItems}</p>
            <p className="text-xs text-muted-foreground">Items Counted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{acceptedItems}</p>
            <p className="text-xs text-muted-foreground">Accepted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{missingValue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Missing (KWD)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{surplusValue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Surplus (KWD)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
        <Button size="sm" variant={filter === 'variance' ? 'default' : 'outline'} onClick={() => setFilter('variance')}>With Variance</Button>
        <Button size="sm" variant={filter === 'pending' ? 'default' : 'outline'} onClick={() => setFilter('pending')}>Pending</Button>
      </div>

      {/* Variance Table */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">System Qty</TableHead>
                <TableHead className="text-right">Counted Qty</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Variance Value</TableHead>
                <TableHead>Status</TableHead>
                {!isCompleted && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries?.map(entry => (
                <VarianceRow
                  key={entry.id}
                  entry={entry}
                  isCompleted={!!isCompleted}
                  onAccept={handleAccept}
                  onRecount={handleRecount}
                  isPending={updateEntry.isPending}
                />
              ))}
              {(!filteredEntries || filteredEntries.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No entries match the filter
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

// Sub-component for each row
const VarianceRow = ({
  entry,
  isCompleted,
  onAccept,
  onRecount,
  isPending,
}: {
  entry: any;
  isCompleted: boolean;
  onAccept: (id: string, reason?: VarianceReason) => void;
  onRecount: (id: string) => void;
  isPending: boolean;
}) => {
  const [reason, setReason] = useState<VarianceReason | ''>('');

  const varianceColor =
    entry.variance < 0 ? 'text-destructive font-semibold' :
    entry.variance > 0 ? 'text-blue-600 font-semibold' :
    'text-green-600';

  const statusBadge: Record<StockTakeEntryStatus, string> = {
    pending: 'bg-muted text-muted-foreground',
    counted: 'bg-yellow-100 text-yellow-800',
    recounting: 'bg-orange-100 text-orange-700',
    accepted: 'bg-green-100 text-green-800',
  };

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium text-sm">{entry.product?.name}</p>
          {entry.product?.name_ar && <p className="text-xs text-muted-foreground" dir="rtl">{entry.product.name_ar}</p>}
        </div>
      </TableCell>
      <TableCell className="text-right">{entry.system_quantity}</TableCell>
      <TableCell className="text-right">{entry.counted_quantity ?? '—'}</TableCell>
      <TableCell className={`text-right ${varianceColor}`}>{entry.variance}</TableCell>
      <TableCell className={`text-right ${varianceColor}`}>{entry.variance_value?.toFixed(2)} KWD</TableCell>
      <TableCell>
        <Badge variant="outline" className={statusBadge[entry.status as StockTakeEntryStatus]}>
          {entry.status}
        </Badge>
      </TableCell>
      {!isCompleted && (
        <TableCell>
          {entry.status === 'counted' && entry.variance !== 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Select value={reason} onValueChange={v => setReason(v as VarianceReason)}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Reason..." />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={isPending || (!reason && Math.abs(entry.variance) > 0)}
                onClick={() => onAccept(entry.id, reason as VarianceReason)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                disabled={isPending}
                onClick={() => onRecount(entry.id)}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Recount
              </Button>
            </div>
          )}
          {entry.status === 'counted' && entry.variance === 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={isPending}
              onClick={() => onAccept(entry.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Accept
            </Button>
          )}
          {entry.status === 'accepted' && (
            <span className="text-xs text-green-600">✓ Accepted{entry.variance_reason ? ` (${entry.variance_reason})` : ''}</span>
          )}
        </TableCell>
      )}
    </TableRow>
  );
};
