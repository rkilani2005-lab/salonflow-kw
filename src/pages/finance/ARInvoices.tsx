import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useARInvoices, useCreateARInvoice, useRecordARPayment, ARInvoice, ARInvoiceItem, ARPayment } from '@/hooks/useFinance';
import { useClients } from '@/hooks/useClients';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  FileText, Plus, ChevronDown, ChevronUp, CreditCard,
  Loader2, AlertTriangle, CheckCircle2, Clock, X,
  Trash2, Download, Search,
} from 'lucide-react';
import { format, isPast, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

// ── Status config ──────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'bg-muted text-muted-foreground border-border' },
  sent:     { label: 'Sent',     color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400' },
  partial:  { label: 'Partial',  color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400' },
  paid:     { label: 'Paid',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' },
  overdue:  { label: 'Overdue',  color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400' },
  void:     { label: 'Void',     color: 'bg-muted text-muted-foreground border-border line-through' },
};

// ── Payment method labels ──────────────────────────────────────
const PAY_METHODS = ['cash','knet','credit_card','bank_transfer','cheque','other'];

export default function ARInvoices() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<ARInvoice | null>(null);

  const { data: invoices = [], isLoading } = useARInvoices(statusFilter === 'all' ? undefined : statusFilter);
  const { data: clients = [] } = useClients();
  const createInvoice = useCreateARInvoice();
  const recordPayment = useRecordARPayment();

  const fmt = (n: number) => `${Number(n).toFixed(3)} ${currency}`;

  // ── Computed KPIs ─────────────────────────────────────────────
  const all = invoices;
  const outstanding = all.filter(i => ['sent','partial','overdue'].includes(i.status))
    .reduce((s, i) => s + Number(i.balance_due), 0);
  const overdue = all.filter(i => i.status === 'overdue' || (i.status !== 'paid' && i.status !== 'void' && isPast(parseISO(i.due_date))))
    .reduce((s, i) => s + Number(i.balance_due), 0);
  const collected = all.filter(i => i.status === 'paid')
    .reduce((s, i) => s + Number(i.total_amount), 0);

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = all.filter(i =>
    search === '' ||
    i.client_name.toLowerCase().includes(search.toLowerCase()) ||
    i.invoice_number.toLowerCase().includes(search.toLowerCase())
  );

  // ── New invoice form state ────────────────────────────────────
  const emptyItem = () => ({ description: '', quantity: 1, unit_price: '', tax_rate: 0, total_price: 0, account_id: null });
  const [newForm, setNewForm] = useState({
    client_id: '', client_name: '', invoice_date: format(new Date(),'yyyy-MM-dd'),
    due_date: format(new Date(Date.now()+30*86400000),'yyyy-MM-dd'),
    notes: '', status: 'draft' as ARInvoice['status'],
    subtotal: 0, tax_amount: 0, discount_amount: 0,
  });
  const [newItems, setNewItems] = useState([emptyItem()]);

  const updateItem = (i: number, field: string, val: any) => {
    const next = [...newItems];
    (next[i] as any)[field] = val;
    const q = Number(next[i].quantity) || 1;
    const p = Number(next[i].unit_price) || 0;
    (next[i] as any).total_price = q * p;
    setNewItems(next);
  };

  const subtotal = newItems.reduce((s, it) => s + Number(it.total_price), 0);
  const taxTotal = newItems.reduce((s, it) => s + Number(it.total_price) * (Number(it.tax_rate)/100), 0);
  const grandTotal = subtotal + taxTotal - Number(newForm.discount_amount || 0);

  const handleCreateInvoice = async () => {
    if (!newForm.client_name) return;
    await createInvoice.mutateAsync({
      ...newForm,
      invoice_number: '',
      subtotal, tax_amount: taxTotal,
      total_amount: grandTotal, currency,
      items: newItems.map(it => ({
        description: it.description,
        quantity:    Number(it.quantity),
        unit_price:  Number(it.unit_price),
        tax_rate:    Number(it.tax_rate),
        total_price: Number(it.total_price),
        account_id:  null,
      })) as any,
    } as any);
    setNewOpen(false);
    setNewForm({ client_id:'', client_name:'', invoice_date: format(new Date(),'yyyy-MM-dd'),
      due_date: format(new Date(Date.now()+30*86400000),'yyyy-MM-dd'), notes:'', status:'draft',
      subtotal:0, tax_amount:0, discount_amount:0 });
    setNewItems([emptyItem()]);
  };

  // ── Payment form ───────────────────────────────────────────────
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'cash', reference_number: '', notes: '' });
  const handleRecordPayment = async () => {
    if (!payOpen || !payForm.amount) return;
    await recordPayment.mutateAsync({
      ar_invoice_id:    payOpen.id,
      payment_date:     format(new Date(),'yyyy-MM-dd'),
      amount:           Number(payForm.amount),
      payment_method:   payForm.payment_method,
      reference_number: payForm.reference_number || null,
      check_number:     null, notes: payForm.notes || null,
      invoice_total:    payOpen.total_amount,
      invoice_paid:     payOpen.paid_amount,
    });
    setPayOpen(null);
    setPayForm({ amount:'', payment_method:'cash', reference_number:'', notes:'' });
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">Finance</p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily:'Bricolage Grotesque,sans-serif', letterSpacing:'-0.04em' }}>
            {ar ? 'فواتير العملاء' : 'Client Invoices'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">{ar ? 'الذمم المدينة، الدفعات الجزئية' : 'Accounts receivable, partial payments, aging'}</p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="gap-1.5 h-9">
          <Plus className="h-4 w-4" />{ar ? 'فاتورة جديدة' : 'New Invoice'}
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: ar ? 'مستحق' : 'Outstanding', val: outstanding, color: 'text-amber-600', Icon: AlertTriangle },
          { label: ar ? 'متأخر' : 'Overdue',     val: overdue,     color: 'text-red-600',   Icon: Clock },
          { label: ar ? 'محصّل' : 'Collected',   val: collected,   color: 'text-emerald-600', Icon: CheckCircle2 },
        ].map(({ label, val, color, Icon }) => (
          <Card key={label} className="border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <p className={cn('stat-number text-xl font-black', color)}>{fmt(val)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={ar ? 'بحث...' : 'Search client or invoice #...'}
            className="h-9 pl-8 text-sm" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {['all','draft','sent','partial','overdue','paid'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('h-7 px-3 rounded-sm text-xs font-semibold border transition-all',
                statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40')}>
              {s === 'all' ? (ar ? 'الكل' : 'All') : STATUS_CFG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice list */}
      {isLoading ? (
        <LoadingState variant="rows" rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          size="compact"
          title={ar ? 'لا توجد فواتير' : 'No invoices found'}
          description={ar ? 'أنشئ فاتورة جديدة' : 'Create your first invoice above.'}
        />
      ) : (
        <div className="border rounded-md overflow-hidden divide-y divide-border">
          {filtered.map(inv => {
            const isExpanded = expanded === inv.id;
            const cfg = STATUS_CFG[inv.status] || STATUS_CFG.draft;
            const daysOverdue = inv.status !== 'paid' && inv.status !== 'void'
              ? Math.max(0, differenceInDays(new Date(), parseISO(inv.due_date)))
              : 0;
            const pctPaid = inv.total_amount > 0
              ? Math.round((Number(inv.paid_amount) / Number(inv.total_amount)) * 100)
              : 0;

            return (
              <div key={inv.id} className="bg-card">
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold">{inv.invoice_number}</p>
                      <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-sm font-bold border', cfg.color)}>
                        {cfg.label}
                      </Badge>
                      {daysOverdue > 0 && inv.status !== 'paid' && inv.status !== 'void' && (
                        <span className="text-[10px] text-red-500 font-semibold">{daysOverdue}d overdue</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {inv.client_name} · Due {format(parseISO(inv.due_date),'MMM d, yyyy')}
                    </p>
                    {inv.status === 'partial' && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-1 w-24 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pctPaid}%` }}/>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{pctPaid}% paid</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="stat-number text-base font-black">{fmt(inv.total_amount)}</p>
                    {Number(inv.balance_due) > 0 && (
                      <p className="text-[10px] text-red-500 font-medium">{fmt(inv.balance_due)} due</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {inv.status !== 'paid' && inv.status !== 'void' && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        onClick={() => setPayOpen(inv)}>
                        <CreditCard className="h-3 w-3"/>{ar ? 'دفع' : 'Pay'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => setExpanded(isExpanded ? null : inv.id)}>
                      {isExpanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                    </Button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-5 pb-4 space-y-4 bg-muted/10 border-t border-border">
                    {/* Line items */}
                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        {ar ? 'بنود الفاتورة' : 'Line Items'}
                      </p>
                      <div className="border rounded-md overflow-hidden text-xs">
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted font-semibold text-muted-foreground">
                          <span className="col-span-6">{ar ? 'الوصف' : 'Description'}</span>
                          <span className="col-span-2 text-right">{ar ? 'الكمية' : 'Qty'}</span>
                          <span className="col-span-2 text-right">{ar ? 'السعر' : 'Unit Price'}</span>
                          <span className="col-span-2 text-right">{ar ? 'الإجمالي' : 'Total'}</span>
                        </div>
                        {(inv.items || []).map((item: ARInvoiceItem) => (
                          <div key={item.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-border">
                            <span className="col-span-6 truncate">{item.description}</span>
                            <span className="col-span-2 text-right">{item.quantity}</span>
                            <span className="col-span-2 text-right stat-number">{Number(item.unit_price).toFixed(3)}</span>
                            <span className="col-span-2 text-right stat-number font-semibold">{Number(item.total_price).toFixed(3)}</span>
                          </div>
                        ))}
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-border bg-muted/30">
                          <span className="col-span-10 text-right font-bold">{ar ? 'الإجمالي' : 'Total'}</span>
                          <span className="col-span-2 text-right stat-number font-black">{fmt(inv.total_amount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment history */}
                    {(inv.payments || []).length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                          {ar ? 'سجل الدفعات' : 'Payment History'}
                        </p>
                        <div className="space-y-1.5">
                          {(inv.payments as ARPayment[]).map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900">
                              <span className="text-muted-foreground">{format(parseISO(p.payment_date),'MMM d, yyyy')} · {p.payment_method}</span>
                              <span className="font-black stat-number text-emerald-700 dark:text-emerald-400">+{fmt(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {inv.notes && (
                      <p className="text-xs text-muted-foreground italic">{inv.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Invoice Dialog ── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary"/>
              {ar ? 'فاتورة جديدة' : 'New Invoice'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold">{ar ? 'العميل *' : 'Client *'}</Label>
                <Select value={newForm.client_id}
                  onValueChange={v => {
                    const c = (clients as any[]).find((x:any) => x.id === v);
                    setNewForm(f => ({ ...f, client_id: v, client_name: c?.name || '' }));
                  }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={ar ? 'اختر عميلة' : 'Select client'}/></SelectTrigger>
                  <SelectContent>
                    {(clients as any[]).map((c:any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `· ${c.phone}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'تاريخ الفاتورة' : 'Invoice Date'}</Label>
                <Input type="date" value={newForm.invoice_date}
                  onChange={e => setNewForm(f => ({ ...f, invoice_date: e.target.value }))} className="h-9"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'تاريخ الاستحقاق' : 'Due Date'}</Label>
                <Input type="date" value={newForm.due_date}
                  onChange={e => setNewForm(f => ({ ...f, due_date: e.target.value }))} className="h-9"/>
              </div>
            </div>

            <Separator/>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">{ar ? 'البنود' : 'Line Items'}</Label>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                  onClick={() => setNewItems([...newItems, emptyItem()])}>
                  <Plus className="h-3 w-3"/>{ar ? 'إضافة' : 'Add'}
                </Button>
              </div>
              {newItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-5 h-9 text-xs" placeholder={ar ? 'الوصف' : 'Description'}
                    value={item.description} onChange={e => updateItem(idx,'description',e.target.value)}/>
                  <Input className="col-span-2 h-9 text-xs" type="number" min="1" placeholder="Qty"
                    value={item.quantity} onChange={e => updateItem(idx,'quantity',e.target.value)}/>
                  <Input className="col-span-3 h-9 text-xs" type="number" min="0" step="0.001" placeholder={ar ? 'السعر' : 'Unit Price'}
                    value={item.unit_price} onChange={e => updateItem(idx,'unit_price',e.target.value)}/>
                  <p className="col-span-1 text-xs stat-number font-semibold text-right">
                    {Number(item.total_price).toFixed(3)}
                  </p>
                  <Button size="sm" variant="ghost" className="col-span-1 h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive"
                    onClick={() => setNewItems(newItems.filter((_,i) => i !== idx))} disabled={newItems.length === 1}>
                    <X className="h-3.5 w-3.5"/>
                  </Button>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border rounded-md p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{ar ? 'المجموع الجزئي' : 'Subtotal'}</span><span className="stat-number font-semibold">{fmt(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{ar ? 'الضريبة' : 'Tax'}</span><span className="stat-number">{fmt(taxTotal)}</span></div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{ar ? 'خصم' : 'Discount'}</span>
                <Input type="number" min="0" step="0.001" className="h-7 w-32 text-xs text-right"
                  value={newForm.discount_amount} onChange={e => setNewForm(f => ({ ...f, discount_amount: Number(e.target.value) }))}/>
              </div>
              <Separator/>
              <div className="flex justify-between font-black"><span>{ar ? 'الإجمالي' : 'Total'}</span><span className="stat-number text-base">{fmt(grandTotal)}</span></div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} className="text-sm resize-none" placeholder={ar ? 'ملاحظات اختيارية' : 'Optional notes...'}/>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateInvoice}
              disabled={createInvoice.isPending || !newForm.client_name || newItems.every(i => !i.description)}
              className="gap-1.5 min-w-[110px]">
              {createInvoice.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <FileText className="h-3.5 w-3.5"/>}
              {createInvoice.isPending ? 'Creating...' : (ar ? 'إنشاء الفاتورة' : 'Create Invoice')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Payment Dialog ── */}
      <Dialog open={!!payOpen} onOpenChange={v => !v && setPayOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary"/>
              {ar ? 'تسجيل دفعة' : 'Record Payment'} — {payOpen?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {payOpen && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 text-sm">
                <span className="text-muted-foreground">{ar ? 'المبلغ المستحق' : 'Balance Due'}</span>
                <span className="stat-number font-black text-red-600">{fmt(payOpen.balance_due)}</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'المبلغ *' : 'Amount *'}</Label>
                <Input type="number" min="0.001" step="0.001" max={payOpen.balance_due}
                  value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="h-10" placeholder="0.000" autoFocus/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'طريقة الدفع' : 'Payment Method'}</Label>
                <Select value={payForm.payment_method} onValueChange={v => setPayForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {PAY_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace('_',' ').toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'رقم المرجع' : 'Reference #'}</Label>
                <Input value={payForm.reference_number}
                  onChange={e => setPayForm(f => ({ ...f, reference_number: e.target.value }))}
                  className="h-9" placeholder={ar ? 'اختياري' : 'Optional'}/>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPayOpen(null)}>Cancel</Button>
            <Button size="sm" onClick={handleRecordPayment}
              disabled={recordPayment.isPending || !payForm.amount}
              className="gap-1.5 min-w-[110px]">
              {recordPayment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle2 className="h-3.5 w-3.5"/>}
              {recordPayment.isPending ? 'Saving...' : (ar ? 'تسجيل' : 'Record Payment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
