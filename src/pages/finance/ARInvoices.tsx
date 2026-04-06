import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useARInvoices, useCreateARInvoice, useRecordARPayment, type ARInvoice } from '@/hooks/useFinance';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText, Plus, Search, DollarSign, Clock, CheckCircle2,
  AlertTriangle, XCircle, Loader2, ChevronDown, ChevronUp,
  CreditCard, Banknote, Receipt, Download, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{className?:string}> }> = {
  draft:   { label: 'Draft',   color: 'bg-muted text-muted-foreground border-border',                                              icon: FileText },
  sent:    { label: 'Sent',    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',         icon: FileText },
  partial: { label: 'Partial', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',    icon: Clock },
  paid:    { label: 'Paid',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-800',              icon: AlertTriangle },
  void:    { label: 'Void',    color: 'bg-muted text-muted-foreground line-through border-border',                                  icon: XCircle },
};

// ── New Invoice Dialog ────────────────────────────────────────
function NewInvoiceDialog({ open, onOpenChange, currency }: { open: boolean; onOpenChange: (v: boolean) => void; currency: string }) {
  const { data: clients = [] } = useClients();
  const create = useCreateARInvoice();

  const [clientId, setClientId]   = useState('');
  const [clientName, setClientName] = useState('');
  const [dueDate, setDueDate]     = useState('');
  const [notes, setNotes]         = useState('');
  const [lines, setLines]         = useState([{ description: '', qty: '1', price: '', tax: '0' }]);
  const [saving, setSaving]       = useState(false);

  const addLine = () => setLines(l => [...l, { description: '', qty: '1', price: '', tax: '0' }]);
  const removeLine = (i: number) => setLines(l => l.filter((_, j) => j !== i));
  const updateLine = (i: number, field: string, v: string) =>
    setLines(l => l.map((line, j) => j === i ? { ...line, [field]: v } : line));

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.qty)||0) * (parseFloat(l.price)||0), 0);
  const tax      = lines.reduce((s, l) => s + (parseFloat(l.qty)||0) * (parseFloat(l.price)||0) * ((parseFloat(l.tax)||0)/100), 0);
  const total    = subtotal + tax;

  const handleSubmit = async () => {
    if ((!clientId && !clientName) || !dueDate || lines.every(l => !l.price)) return;
    const selectedClient = clients.find(c => c.id === clientId);
    setSaving(true);
    try {
      await create.mutateAsync({
        client_id:       clientId || null,
        client_name:     selectedClient?.name || clientName,
        invoice_date:    format(new Date(), 'yyyy-MM-dd'),
        due_date:        dueDate,
        status:          'draft',
        subtotal,
        tax_amount:      tax,
        discount_amount: 0,
        total_amount:    total,
        currency,
        notes:           notes || null,
        items: lines.filter(l => l.description || l.price).map(l => ({
          description: l.description,
          quantity:    parseFloat(l.qty) || 1,
          unit_price:  parseFloat(l.price) || 0,
          tax_rate:    parseFloat(l.tax) || 0,
          total_price: (parseFloat(l.qty)||1) * (parseFloat(l.price)||0),
          account_id:  null,
        })),
      });
      onOpenChange(false);
      setClientId(''); setClientName(''); setDueDate(''); setNotes('');
      setLines([{ description: '', qty: '1', price: '', tax: '0' }]);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="h-7 w-7 rounded-sm bg-primary/10 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            New Client Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Client + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Client *</Label>
              <Select value={clientId} onValueChange={v => { setClientId(v); setClientName(''); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select client..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!clientId && (
                <Input value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="Or type client name..." className="h-8 text-xs mt-1" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Due Date *</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9" />
            </div>
          </div>

          <Separator />

          {/* Line items */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-1">
              <span className="col-span-5">Description</span>
              <span className="col-span-2 text-right">Qty</span>
              <span className="col-span-2 text-right">Price</span>
              <span className="col-span-2 text-right">Tax %</span>
              <span className="col-span-1" />
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                  placeholder="Service or item..." className="col-span-5 h-8 text-xs" />
                <Input type="number" value={line.qty} onChange={e => updateLine(i, 'qty', e.target.value)}
                  className="col-span-2 h-8 text-xs text-right" />
                <Input type="number" value={line.price} onChange={e => updateLine(i, 'price', e.target.value)}
                  placeholder="0.000" className="col-span-2 h-8 text-xs text-right" />
                <Input type="number" value={line.tax} onChange={e => updateLine(i, 'tax', e.target.value)}
                  placeholder="0" className="col-span-2 h-8 text-xs text-right" />
                <button onClick={() => removeLine(i)} disabled={lines.length === 1}
                  className="col-span-1 flex items-center justify-center text-muted-foreground/40 hover:text-destructive disabled:opacity-20">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addLine} className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" />Add Line
            </Button>
          </div>

          <Separator />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="space-y-1.5 text-sm min-w-[200px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{subtotal.toFixed(3)} {currency}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span><span>{tax.toFixed(3)} {currency}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span><span>{total.toFixed(3)} {currency}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none text-sm" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit}
            disabled={saving || (!clientId && !clientName) || !dueDate}
            className="gap-1.5 min-w-[120px]">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {saving ? 'Creating...' : 'Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Record Payment Dialog ─────────────────────────────────────
function RecordPaymentDialog({ invoice, open, onOpenChange, currency }: {
  invoice: ARInvoice; open: boolean; onOpenChange: (v: boolean) => void; currency: string;
}) {
  const record = useRecordARPayment();
  const [amount, setAmount]   = useState(invoice.balance_due.toFixed(3));
  const [method, setMethod]   = useState('cash');
  const [ref, setRef]         = useState('');
  const [date, setDate]       = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await record.mutateAsync({
        ar_invoice_id:    invoice.id,
        payment_date:     date,
        amount:           parseFloat(amount),
        payment_method:   method,
        reference_number: ref || null,
        check_number:     null,
        notes:            null,
        invoice_total:    invoice.total_amount,
        invoice_paid:     invoice.paid_amount,
      });
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Record Payment — {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="p-3 rounded-md bg-muted/40 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice total</span><span>{invoice.total_amount.toFixed(3)} {currency}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Already paid</span><span>{invoice.paid_amount.toFixed(3)} {currency}</span></div>
            <div className="flex justify-between font-bold text-primary"><span>Balance due</span><span>{invoice.balance_due.toFixed(3)} {currency}</span></div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Amount ({currency})</Label>
            <Input type="number" step="0.001" max={invoice.balance_due}
              value={amount} onChange={e => setAmount(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="knet">K-NET</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reference (optional)</Label>
            <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="Transfer ref, cheque no..." className="h-9" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !amount} className="gap-1.5 min-w-[120px]">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {saving ? 'Saving...' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Invoice Row ────────────────────────────────────────────────
function InvoiceRow({ inv, currency }: { inv: ARInvoice; currency: string }) {
  const [expanded, setExpanded] = useState(false);
  const [payOpen, setPayOpen]   = useState(false);

  const statusKey = (() => {
    if (inv.status === 'sent' && differenceInDays(new Date(), new Date(inv.due_date)) > 0) return 'overdue';
    return inv.status;
  })();
  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  const daysOverdue = statusKey === 'overdue' ? differenceInDays(new Date(), new Date(inv.due_date)) : 0;

  return (
    <>
      <div className={cn('flex items-center gap-4 px-5 py-3.5 border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer', expanded && 'bg-muted/20')}
        onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{inv.invoice_number}</span>
            <span className="text-xs text-muted-foreground">{inv.client_name}</span>
            <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-sm font-bold border', cfg.color)}>
              <Icon className="h-2.5 w-2.5 mr-0.5" />{cfg.label}
              {daysOverdue > 0 && ` · ${daysOverdue}d`}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Issued {format(new Date(inv.invoice_date), 'MMM d')} · Due {format(new Date(inv.due_date), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold stat-number">{Number(inv.total_amount).toFixed(3)} {currency}</p>
          {Number(inv.balance_due) > 0 && (
            <p className="text-[10px] text-red-500 font-semibold">
              {Number(inv.balance_due).toFixed(3)} due
            </p>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="px-5 py-4 bg-muted/10 border-b border-border/50 space-y-4">
          {/* Line items */}
          {inv.items && inv.items.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Items</p>
              {inv.items.map(item => (
                <div key={item.id} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground">{item.description} × {item.quantity}</span>
                  <span className="font-medium">{Number(item.total_price).toFixed(3)} {currency}</span>
                </div>
              ))}
            </div>
          )}

          {/* Payment history */}
          {inv.payments && inv.payments.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2">Payment History</p>
              {inv.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span>{format(new Date(p.payment_date), 'MMM d, yyyy')}</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 rounded-sm">{p.payment_method}</Badge>
                    {p.reference_number && <span className="text-muted-foreground">#{p.reference_number}</span>}
                  </div>
                  <span className="font-semibold text-emerald-600">+{Number(p.amount).toFixed(3)} {currency}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {Number(inv.balance_due) > 0 && inv.status !== 'void' && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setPayOpen(true)}>
                <Banknote className="h-3.5 w-3.5" />Record Payment
              </Button>
            </div>
          )}
        </div>
      )}

      {payOpen && (
        <RecordPaymentDialog invoice={inv} open={payOpen} onOpenChange={setPayOpen} currency={currency} />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function ARInvoices() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [newOpen, setNewOpen]           = useState(false);

  const { data: invoices = [], isLoading } = useARInvoices(statusFilter === 'all' ? undefined : statusFilter);

  const filtered = invoices.filter(inv =>
    !search || inv.client_name.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase())
  );

  // KPI summaries
  const totalOutstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'void')
    .reduce((s, i) => s + Number(i.balance_due), 0);
  const totalOverdue = invoices.filter(i =>
    i.status !== 'paid' && i.status !== 'void' && differenceInDays(new Date(), new Date(i.due_date)) > 0
  ).reduce((s, i) => s + Number(i.balance_due), 0);
  const totalPaidThisMonth = invoices.filter(i => i.status === 'paid')
    .reduce((s, i) => s + Number(i.paid_amount), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1">Finance</p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.04em' }}>
            {ar ? 'فواتير العملاء' : 'Client Invoices'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Accounts receivable — issue, track, and collect</p>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5 h-9">
          <Plus className="h-3.5 w-3.5" />New Invoice
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Outstanding',   value: totalOutstanding,  color: 'text-amber-600', icon: Clock },
          { label: 'Overdue',       value: totalOverdue,      color: 'text-red-500',   icon: AlertTriangle },
          { label: 'Collected',     value: totalPaidThisMonth,color: 'text-emerald-600',icon: CheckCircle2 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="kpi-card bg-card border rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">{label}</p>
              <Icon className={cn('h-3.5 w-3.5', color)} />
            </div>
            <p className={cn('text-2xl font-black stat-number', color)}>{value.toFixed(3)}</p>
            <p className="text-[10px] text-muted-foreground">{currency}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by client or invoice number..." className="pl-9 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-xs"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoice list */}
      <div className="border rounded-md overflow-hidden bg-card">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center text-muted-foreground gap-2">
            <Receipt className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">No invoices found</p>
            <p className="text-xs opacity-60">Create your first invoice to start tracking receivables</p>
          </div>
        ) : (
          filtered.map(inv => <InvoiceRow key={inv.id} inv={inv} currency={currency} />)
        )}
      </div>

      <NewInvoiceDialog open={newOpen} onOpenChange={setNewOpen} currency={currency} />
    </div>
  );
}
