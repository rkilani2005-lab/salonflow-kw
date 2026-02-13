import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  usePurchaseOrderItems,
  useUpdatePOStatus,
  PO_STATUS_CONFIG,
  type PurchaseOrder,
} from '@/hooks/usePurchaseOrders';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Send, ArrowUpCircle, Ban } from 'lucide-react';

interface PODetailSheetProps {
  po: PurchaseOrder | null;
  onClose: () => void;
}

export const PODetailSheet = ({ po, onClose }: PODetailSheetProps) => {
  const { data: items, isLoading: itemsLoading } = usePurchaseOrderItems(po?.id || null);
  const updateStatus = useUpdatePOStatus();
  const { user, hasRole } = useAuth();

  if (!po) return null;

  const canApprove = (hasRole('owner') || hasRole('manager')) && po.status === 'pending_approval';
  // 4-eyes: approver != requester
  const isRequester = po.requested_by === user?.id;
  const canApproveThis = canApprove && !isRequester;

  const canSubmitForApproval = po.status === 'draft';
  const canSend = po.status === 'approved';
  const canCancel = ['draft', 'pending_approval', 'approved'].includes(po.status);

  const handleStatusChange = (status: 'pending_approval' | 'approved' | 'sent' | 'cancelled') => {
    updateStatus.mutate(
      { id: po.id, status },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Sheet open={!!po} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="font-mono">{po.po_number}</span>
            <Badge className={`text-xs ${PO_STATUS_CONFIG[po.status]?.color || ''}`} variant="outline">
              {PO_STATUS_CONFIG[po.status]?.label}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Supplier Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Supplier</p>
              <p className="font-medium">{po.supplier?.name}</p>
              {po.supplier?.name_ar && <p className="text-xs text-muted-foreground" dir="rtl">{po.supplier.name_ar}</p>}
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium">{format(new Date(po.created_at), 'dd MMM yyyy')}</p>
            </div>
            {po.payment_terms && (
              <div>
                <p className="text-muted-foreground">Payment Terms</p>
                <p className="font-medium">{po.payment_terms}</p>
              </div>
            )}
            {po.approved_at && (
              <div>
                <p className="text-muted-foreground">Approved</p>
                <p className="font-medium">{format(new Date(po.approved_at), 'dd MMM yyyy HH:mm')}</p>
              </div>
            )}
            {po.sent_at && (
              <div>
                <p className="text-muted-foreground">Sent</p>
                <p className="font-medium">{format(new Date(po.sent_at), 'dd MMM yyyy HH:mm')} ({po.sent_via})</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h3 className="font-semibold mb-3">Line Items</h3>
            {itemsLoading ? (
              <p className="text-muted-foreground text-sm">Loading items...</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className="font-medium">{item.product?.name || '—'}</span>
                          {item.product?.sku && (
                            <span className="block text-xs text-muted-foreground">{item.product.sku}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.quantity_ordered} {item.product?.usage_unit || ''}
                        </TableCell>
                        <TableCell className="text-right font-mono">{item.quantity_received}</TableCell>
                        <TableCell className="text-right font-mono">{item.unit_cost.toFixed(3)}</TableCell>
                        <TableCell className="text-right font-mono">{item.total_cost.toFixed(3)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-semibold">Total</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{po.total_amount.toFixed(3)} KWD</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Notes */}
          {po.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-1">Notes</h3>
                <p className="text-sm text-muted-foreground">{po.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {canSubmitForApproval && (
              <Button
                variant="default"
                onClick={() => handleStatusChange('pending_approval')}
                disabled={updateStatus.isPending}
              >
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            )}

            {canApproveThis && (
              <Button
                variant="default"
                onClick={() => handleStatusChange('approved')}
                disabled={updateStatus.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            )}

            {canApprove && isRequester && (
              <p className="text-xs text-muted-foreground self-center">
                You cannot approve your own PO (4-eyes principle).
              </p>
            )}

            {po.status === 'pending_approval' && (hasRole('owner') || hasRole('manager')) && (
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => handleStatusChange('cancelled')}
                disabled={updateStatus.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            )}

            {canSend && (
              <Button
                variant="default"
                onClick={() => handleStatusChange('sent')}
                disabled={updateStatus.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Mark as Sent
              </Button>
            )}

            {canCancel && po.status !== 'pending_approval' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive">
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel PO
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Purchase Order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel {po.po_number}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => handleStatusChange('cancelled')}
                    >
                      Cancel PO
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
