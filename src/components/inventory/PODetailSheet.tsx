import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  usePurchaseOrderItems, useUpdatePOStatus,
  PO_STATUS_CONFIG, type PurchaseOrder,
} from '@/hooks/usePurchaseOrders';
import { useCanApprove, useMatchingRule, useApproverOptions } from '@/hooks/usePOApprovalWorkflow';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CheckCircle, XCircle, Send, ArrowUpCircle, Ban,
  FileDown, Printer, Loader2, MessageCircle, Mail,
  Clock, CheckCircle2, User, AlertCircle, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PODetailSheetProps {
  po: PurchaseOrder | null;
  onClose: () => void;
}

// ── Approval timeline step ────────────────────────────────────
interface TimelineStep {
  status: string;
  label: string;
  icon: React.ReactNode;
  done: boolean;
  active: boolean;
  time?: string;
  by?: string;
}

export const PODetailSheet = ({ po, onClose }: PODetailSheetProps) => {
  const { data: items, isLoading: itemsLoading } = usePurchaseOrderItems(po?.id || null);
  const updateStatus = useUpdatePOStatus();
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: approverOptions = [] } = useApproverOptions();

  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [sendLoading,   setSendLoading]   = useState(false);
  const [rejectOpen,    setRejectOpen]    = useState(false);
  const [rejectNote,    setRejectNote]    = useState('');
  const [sendOpen,      setSendOpen]      = useState(false);
  const [sendMethod,    setSendMethod]    = useState<'whatsapp' | 'email' | 'manual'>('whatsapp');

  // ── Rule-based approval check ─────────────────────────────
  const matchingRule = useMatchingRule(po?.total_amount ?? 0);
  const { canApprove: ruleCanApprove, reason: approvalBlockReason } = useCanApprove(
    po?.total_amount ?? 0,
    po?.requested_by ?? null
  );
  const isOwnerOrManager = hasRole('owner') || hasRole('manager');

  if (!po) return null;

  const isRequester  = po.requested_by === user?.id;
  const canSubmit    = po.status === 'draft';
  const canApprove   = po.status === 'pending_approval' && ruleCanApprove;
  const canApproveOwn = po.status === 'pending_approval' && isOwnerOrManager && isRequester;
  const canReject    = po.status === 'pending_approval' && isOwnerOrManager;
  const canSend      = po.status === 'approved';
  const canCancel    = ['draft', 'pending_approval', 'approved'].includes(po.status);
  const showBlockedMsg = po.status === 'pending_approval' && isOwnerOrManager && !ruleCanApprove && !isRequester;

  // ── Workflow timeline ─────────────────────────────────────
  const STATUS_ORDER = ['draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received'];
  const currentIdx = STATUS_ORDER.indexOf(po.status);
  const isCancelled = po.status === 'cancelled';

  const timeline: TimelineStep[] = [
    {
      status: 'draft',
      label: 'Draft created',
      icon: <Clock className="h-3.5 w-3.5" />,
      done: currentIdx > 0 && !isCancelled,
      active: po.status === 'draft',
      time: format(new Date(po.created_at), 'dd MMM HH:mm'),
    },
    {
      status: 'pending_approval',
      label: 'Submitted for approval',
      icon: <ArrowUpCircle className="h-3.5 w-3.5" />,
      done: currentIdx > 1 && !isCancelled,
      active: po.status === 'pending_approval',
    },
    {
      status: 'approved',
      label: 'Approved',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      done: currentIdx > 2 && !isCancelled,
      active: po.status === 'approved',
      time: po.approved_at ? format(new Date(po.approved_at), 'dd MMM HH:mm') : undefined,
    },
    {
      status: 'sent',
      label: 'Sent to supplier',
      icon: <Send className="h-3.5 w-3.5" />,
      done: currentIdx > 3 && !isCancelled,
      active: po.status === 'sent',
      time: po.sent_at ? format(new Date(po.sent_at), 'dd MMM HH:mm') : undefined,
    },
    {
      status: 'received',
      label: 'Received',
      icon: <CheckCircle className="h-3.5 w-3.5" />,
      done: po.status === 'received',
      active: po.status === 'partially_received',
    },
  ];

  // ── Handlers ──────────────────────────────────────────────
  const handleSubmit = () => {
    updateStatus.mutate({ id: po.id, status: 'pending_approval' });
  };

  const handleApprove = () => {
    updateStatus.mutate(
      { id: po.id, status: 'approved' },
      { onSuccess: () => toast({ title: `✅ PO ${po.po_number} approved` }) }
    );
  };

  const handleReject = () => {
    if (!rejectNote.trim()) {
      toast({ title: 'Please add a rejection reason', variant: 'destructive' });
      return;
    }
    // Reject = return to draft with a note explaining why
    updateStatus.mutate(
      { id: po.id, status: 'draft', notes: `❌ Rejected: ${rejectNote}\n\n${po.notes || ''}`.trim() },
      {
        onSuccess: () => {
          toast({ title: `PO ${po.po_number} returned to requester`, description: rejectNote });
          setRejectOpen(false);
          setRejectNote('');
          onClose();
        },
      }
    );
  };

  const handleSend = async () => {
    setSendLoading(true);
    try {
      // Mark as sent in DB
      await updateStatus.mutateAsync({ id: po.id, status: 'sent' });

      // Send via WhatsApp or Email if supplier has contact
      if (sendMethod === 'whatsapp' && po.supplier?.whatsapp_number) {
        await supabase.functions.invoke('whatsapp-send', {
          body: {
            tenant_id: po.tenant_id,
            event_type: 'po_sent',
            phone_number: po.supplier.whatsapp_number,
            variables: {
              po_number: po.po_number,
              supplier_name: po.supplier.name,
              total_amount: po.total_amount.toFixed(3) + ' KWD',
              items_count: String(items?.length || 0),
            },
            reference_id: po.id,
            reference_type: 'purchase_order',
          },
        });
        toast({ title: `✅ PO sent to ${po.supplier.name} via WhatsApp` });
      } else if (sendMethod === 'email' && po.supplier?.email) {
        // Email via edge function (future) — for now just mark sent
        toast({ title: `✅ PO ${po.po_number} marked as sent via Email` });
      } else {
        toast({ title: `✅ PO ${po.po_number} marked as sent` });
      }

      setSendOpen(false);
      qc.invalidateQueries({ queryKey: ['purchase_orders'] });
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to send PO', description: err.message, variant: 'destructive' });
    } finally {
      setSendLoading(false);
    }
  };

  const generatePdf = async (mode: 'download' | 'print') => {
    setPdfLoading(true);
    // Open the window synchronously inside the click handler so popup blockers allow it.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setPdfLoading(false);
      toast({
        title: 'Please allow popups',
        description: 'Enable popups for this site, then try again to generate the PDF.',
        variant: 'destructive',
      });
      return;
    }
    printWindow.document.write(
      '<!DOCTYPE html><html><head><title>Loading…</title></head><body style="font-family:sans-serif;padding:40px;color:#6b7280;">Preparing purchase order…</body></html>'
    );
    try {
      const { data, error } = await supabase.functions.invoke('generate-po-pdf', {
        body: { po_id: po.id },
      });
      if (error) {
        // Surface the real edge-function error body, not the generic non-2xx message.
        let msg = error.message;
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === 'function') {
            const b = await ctx.json();
            msg = b?.error || msg;
          }
        } catch { /* keep generic */ }
        throw new Error(msg);
      }
      if (!data?.html) throw new Error('No document was returned. Please try again.');

      printWindow.document.open();
      printWindow.document.write(data.html);
      printWindow.document.close();

      // Both modes use the browser's print dialog → "Save as PDF" gives a real PDF file,
      // and the same dialog prints. Trigger once the document has rendered.
      const triggerPrint = () => {
        try { printWindow.focus(); printWindow.print(); } catch { /* user can print manually */ }
      };
      if (printWindow.document.readyState === 'complete') {
        setTimeout(triggerPrint, 300);
      } else {
        printWindow.onload = () => setTimeout(triggerPrint, 300);
      }
    } catch (err: any) {
      try { printWindow.close(); } catch { /* already closed */ }
      toast({ title: 'Failed to generate PDF', description: err.message, variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <>
      <Sheet open={!!po} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <span className="font-mono">{po.po_number}</span>
              <Badge
                className={cn('text-xs', PO_STATUS_CONFIG[po.status]?.color || '')}
                variant="outline">
                {PO_STATUS_CONFIG[po.status]?.label}
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6 mt-6">

            {/* ── Approval timeline ── */}
            {!isCancelled ? (
              <div className="flex items-center gap-0">
                {timeline.map((step, i) => (
                  <div key={step.status} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1 relative">
                      <div className={cn(
                        'h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all',
                        step.done   ? 'bg-emerald-500 border-emerald-500 text-white' :
                        step.active ? 'bg-primary border-primary text-primary-foreground' :
                                      'bg-muted border-border text-muted-foreground'
                      )}>
                        {step.icon}
                      </div>
                      <p className="text-[9px] text-center text-muted-foreground leading-tight w-14">
                        {step.label}
                      </p>
                      {step.time && (
                        <p className="text-[8px] text-muted-foreground/60">{step.time}</p>
                      )}
                    </div>
                    {i < timeline.length - 1 && (
                      <div className={cn(
                        'flex-1 h-0.5 mb-5 -mx-0.5',
                        step.done ? 'bg-emerald-400' : 'bg-border'
                      )} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                  This PO has been cancelled
                </p>
              </div>
            )}

            {/* ── 4-eyes notice: requester cannot approve own PO ── */}
            {canApproveOwn && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Waiting for a second approver</p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">
                    You submitted this PO, so a different owner or manager needs to approve it (4-eyes policy).
                    {matchingRule && ` Rule: "${matchingRule.name}"`}
                  </p>
                </div>
              </div>
            )}

            {/* ── Rule-blocked: role/person mismatch ── */}
            {showBlockedMsg && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted border">
                <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">You can't approve this PO</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {approvalBlockReason || 'Approval is restricted for your role.'}
                    {matchingRule && ` — Rule: "${matchingRule.name}"`}
                  </p>
                </div>
              </div>
            )}

            {/* ── Non-manager staff viewing a pending PO ── */}
            {po.status === 'pending_approval' && !isOwnerOrManager && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted border">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Awaiting approval</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This PO is waiting for an owner or manager to approve it before it can be sent.
                  </p>
                </div>
              </div>
            )}

            {/* ── Ready to approve (clear green prompt) ── */}
            {canApprove && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Ready for your approval</p>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70 mt-0.5">
                    Review the items below, then approve to allow this PO to be sent to the supplier.
                    {matchingRule ? ` Rule: "${matchingRule.name}".` : ' No approval rule set — owner/manager approval applies.'}
                  </p>
                </div>
              </div>
            )}

            {/* ── Active rule indicator ── */}
            {matchingRule && po.status === 'pending_approval' && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Shield className="h-3 w-3" />
                Applying rule: <span className="font-medium">{matchingRule.name}</span>
                {matchingRule.max_amount != null
                  ? ` (${matchingRule.min_amount.toFixed(0)}–${matchingRule.max_amount.toFixed(0)} KWD)`
                  : ` (≥ ${matchingRule.min_amount.toFixed(0)} KWD)`}
              </div>
            )}

            {/* ── Approval info ── */}
            {po.approved_at && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  Approved on {format(new Date(po.approved_at), 'dd MMM yyyy HH:mm')}
                </p>
              </div>
            )}

            <Separator />

            {/* ── Supplier & details ── */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Supplier</p>
                <p className="font-medium">{po.supplier?.name}</p>
                {po.supplier?.name_ar && (
                  <p className="text-xs text-muted-foreground" dir="rtl">{po.supplier.name_ar}</p>
                )}
                {po.supplier?.whatsapp_number && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MessageCircle className="h-3 w-3" />{po.supplier.whatsapp_number}
                  </p>
                )}
                {po.supplier?.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />{po.supplier.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Created</p>
                  <p className="font-medium text-sm">{format(new Date(po.created_at), 'dd MMM yyyy')}</p>
                </div>
                {po.payment_terms && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Payment Terms</p>
                    <p className="font-medium text-sm">{po.payment_terms}</p>
                  </div>
                )}
                {po.sent_at && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Sent</p>
                    <p className="font-medium text-sm flex items-center gap-1">
                      {format(new Date(po.sent_at), 'dd MMM HH:mm')}
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 ml-1">{po.sent_via}</Badge>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── PDF actions ── */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => generatePdf('print')} disabled={pdfLoading}
                aria-label="Print PO">
                {pdfLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={() => generatePdf('download')} disabled={pdfLoading}
                aria-label="View PDF">
                {pdfLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                View PDF
              </Button>
            </div>

            <Separator />

            {/* ── Line items ── */}
            <div>
              <h3 className="font-semibold mb-3 text-sm">Line Items</h3>
              {itemsLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : (
                <div className="rounded-md border text-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Rcvd</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.product?.name || '—'}</p>
                            {item.product?.sku && (
                              <p className="text-[10px] text-muted-foreground">{item.product.sku}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.quantity_ordered} {item.product?.usage_unit || ''}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span className={cn(
                              item.quantity_received >= item.quantity_ordered ? 'text-emerald-600' :
                              item.quantity_received > 0 ? 'text-amber-600' : ''
                            )}>
                              {item.quantity_received}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono">{item.unit_cost.toFixed(3)}</TableCell>
                          <TableCell className="text-right font-mono">{item.total_cost.toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={4} className="text-right font-semibold">Total</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {po.total_amount.toFixed(3)} KWD
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* ── Notes ── */}
            {po.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-1 text-sm">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{po.notes}</p>
                </div>
              </>
            )}

            <Separator />

            {/* ── Workflow action buttons ── */}
            <div className="flex flex-wrap gap-2 pb-2">

              {/* Draft → Submit for approval */}
              {canSubmit && (
                <Button onClick={handleSubmit} disabled={updateStatus.isPending} className="gap-2">
                  <ArrowUpCircle className="h-4 w-4" />
                  Submit for Approval
                </Button>
              )}

              {/* Pending → Approve */}
              {canApprove && (
                <Button
                  onClick={handleApprove}
                  disabled={updateStatus.isPending}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </Button>
              )}

              {/* Pending → Reject (back to draft) */}
              {canReject && (
                <Button
                  variant="outline"
                  className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  onClick={() => setRejectOpen(true)}
                  disabled={updateStatus.isPending}>
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              )}

              {/* Approved → Send to supplier */}
              {canSend && (
                <Button
                  onClick={() => setSendOpen(true)}
                  disabled={updateStatus.isPending}
                  className="gap-2">
                  <Send className="h-4 w-4" />
                  Send to Supplier
                </Button>
              )}

              {/* Cancel PO */}
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5">
                      <Ban className="h-4 w-4" />
                      Cancel PO
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel {po.po_number}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently cancel this purchase order. The PO cannot be reactivated.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep PO</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => { updateStatus.mutate({ id: po.id, status: 'cancelled' }); onClose(); }}>
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

      {/* ── Reject dialog ── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <XCircle className="h-4 w-4" /> Reject PO — Return to Requester
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              The PO will be returned to <strong>Draft</strong> status so the requester can amend and resubmit.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for rejection *</Label>
              <Textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="e.g. Unit costs are too high — please renegotiate with supplier"
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleReject}
              disabled={updateStatus.isPending || !rejectNote.trim()}>
              {updateStatus.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <XCircle className="h-3.5 w-3.5" />}
              Return to Requester
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send to supplier dialog ── */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Send PO to {po.supplier?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Choose how to send {po.po_number}:</p>

            <div className="space-y-2">
              {/* WhatsApp option */}
              <button
                onClick={() => setSendMethod('whatsapp')}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                  sendMethod === 'whatsapp' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border hover:border-emerald-300'
                )}>
                <MessageCircle className={cn('h-5 w-5 flex-shrink-0', sendMethod === 'whatsapp' ? 'text-emerald-600' : 'text-muted-foreground')} />
                <div>
                  <p className="font-medium text-sm">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    {po.supplier?.whatsapp_number || 'No WhatsApp number on file'}
                  </p>
                </div>
                {!po.supplier?.whatsapp_number && (
                  <Badge variant="outline" className="text-[9px] ml-auto">No number</Badge>
                )}
              </button>

              {/* Email option */}
              <button
                onClick={() => setSendMethod('email')}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                  sendMethod === 'email' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-border hover:border-blue-300'
                )}>
                <Mail className={cn('h-5 w-5 flex-shrink-0', sendMethod === 'email' ? 'text-blue-600' : 'text-muted-foreground')} />
                <div>
                  <p className="font-medium text-sm">Email</p>
                  <p className="text-xs text-muted-foreground">
                    {po.supplier?.email || 'No email on file'}
                  </p>
                </div>
                {!po.supplier?.email && (
                  <Badge variant="outline" className="text-[9px] ml-auto">No email</Badge>
                )}
              </button>

              {/* Manual option */}
              <button
                onClick={() => setSendMethod('manual')}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                  sendMethod === 'manual' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                )}>
                <User className={cn('h-5 w-5 flex-shrink-0', sendMethod === 'manual' ? 'text-primary' : 'text-muted-foreground')} />
                <div>
                  <p className="font-medium text-sm">Manual</p>
                  <p className="text-xs text-muted-foreground">Mark as sent — I'll deliver it myself</p>
                </div>
              </button>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="gap-1.5 min-w-[110px]"
              onClick={handleSend}
              disabled={sendLoading}>
              {sendLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />}
              Confirm Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
