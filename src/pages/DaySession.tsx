import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTodaySession, useOpenDay, useCloseDay, useAddPayout,
  useSessionHistory, useLiveDayTotals, type CashSession,
} from '@/hooks/useCashSession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DoorOpen, DoorClosed, Banknote, CreditCard, TrendingUp,
  TrendingDown, AlertTriangle, CheckCircle2, Clock, Printer,
  Plus, History, ArrowUpRight, ArrowDownRight, Receipt,
  Minus, Calculator,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, cur = 'KWD') =>
  `${(n ?? 0).toFixed(3)} ${cur}`;

// ── Sub-components ───────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color = 'text-foreground', highlight = false,
}: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string; highlight?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-2',
      highlight ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
    )}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <p className={cn('text-xl font-bold stat-number', color)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Open Day Form ────────────────────────────────────────────────

function OpenDayForm({ currency }: { currency: string }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const openDay = useOpenDay();
  const [float, setFloat]   = useState('0.000');
  const [notes, setNotes]   = useState('');
  const [quick, setQuick]   = useState<number | null>(null);

  const QUICK_FLOATS = [0, 10, 20, 50, 100];

  const handleOpen = async () => {
    await openDay.mutateAsync({
      opening_balance: parseFloat(float) || 0,
      opening_notes:   notes || undefined,
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
            <DoorOpen className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {ar ? 'فتح يوم العمل' : 'Open Day'}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        <Card className="border">
          <CardContent className="p-6 space-y-5">
            {/* Opening float */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                {ar ? 'رصيد افتتاح الصندوق' : 'Opening Cash Float'} ({currency})
              </Label>
              <p className="text-xs text-muted-foreground">
                {ar
                  ? 'المبلغ النقدي الموجود في الصندوق عند بدء اليوم'
                  : 'Cash already in the drawer before today\'s sales begin'}
              </p>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={float}
                onChange={e => { setFloat(e.target.value); setQuick(null); }}
                className="h-12 text-lg font-bold text-center"
              />
              {/* Quick amounts */}
              <div className="flex gap-2 flex-wrap">
                {QUICK_FLOATS.map(amt => (
                  <button
                    key={amt}
                    onClick={() => { setFloat(amt.toFixed(3)); setQuick(amt); }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                      quick === amt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:border-primary/40'
                    )}
                  >
                    {amt === 0 ? (ar ? 'لا يوجد' : 'Empty') : `${amt} ${currency}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                {ar ? 'ملاحظات' : 'Notes'} <span className="text-muted-foreground/60">{ar ? '(اختياري)' : '(optional)'}</span>
              </Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                placeholder={ar ? 'أي ملاحظات عند الافتتاح...' : 'Any opening notes...'}
              />
            </div>

            <Button
              onClick={handleOpen}
              disabled={openDay.isPending}
              className="w-full h-12 gap-2 text-base font-bold"
            >
              {openDay.isPending ? (
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <><DoorOpen className="h-5 w-5" />{ar ? 'فتح اليوم' : 'Open Day'}</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Live Session Dashboard ────────────────────────────────────────

function LiveSessionDashboard({
  session, currency,
}: {
  session: ReturnType<typeof useTodaySession>['data'] & {};
  currency: string;
}) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const closeDay  = useCloseDay();
  const addPayout = useAddPayout();

  const [showClose,  setShowClose]  = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Close form state
  const [cashCounted, setCashCounted] = useState('');
  const [knetTotal,   setKnetTotal]   = useState('');
  const [cardTotal,   setCardTotal]   = useState('');
  const [closeNotes,  setCloseNotes]  = useState('');

  // Payout form state
  const [payoutAmt,    setPayoutAmt]    = useState('');
  const [payoutReason, setPayoutReason] = useState('');
  const [payoutTo,     setPayoutTo]     = useState('');

  // Pull live per-method totals from today's transactions.  The snapshot
  // fields on the session row are only written on close, so reading them
  // directly during the open day gave 0 values and a meaningless
  // "Expected Cash" that was just opening_balance minus payouts.
  const { data: live } = useLiveDayTotals();
  const liveCashSales   = live?.cashSales   ?? 0;
  const liveKnetSales   = live?.knetSales   ?? 0;
  const liveCardSales   = live?.cardSales   ?? 0;
  const liveGiftSales   = live?.giftSales   ?? 0;
  const liveCashRefunds = live?.cashRefunds ?? 0;
  const liveRefunds     = live?.refunds     ?? 0;

  const totalPayouts = (session?.payouts || []).reduce((s, p) => s + Number(p.amount), 0);
  // Expected cash = opening + cash sales − cash refunds − cash payouts.
  // The cash-refunds term is critical — without it, a cash refund
  // produces a fake negative variance equal to the refund amount.
  const expectedCash =
    Number(session?.opening_balance || 0) + liveCashSales - liveCashRefunds - totalPayouts;
  const totalRevenue = liveCashSales + liveKnetSales + liveCardSales + liveGiftSales - liveRefunds;

  // Variance preview while typing
  const variance = cashCounted ? parseFloat(cashCounted) - expectedCash : null;

  const handleClose = async () => {
    if (!session) return;
    await closeDay.mutateAsync({
      session_id:            session.id,
      closing_cash_counted:  parseFloat(cashCounted)  || 0,
      closing_knet_terminal: parseFloat(knetTotal)    || 0,
      closing_card_terminal: parseFloat(cardTotal)    || 0,
      closing_notes:         closeNotes || undefined,
    });
    setShowClose(false);
  };

  const handlePayout = async () => {
    if (!session || !payoutAmt || !payoutReason) return;
    await addPayout.mutateAsync({
      session_id: session.id,
      amount:     parseFloat(payoutAmt),
      reason:     payoutReason,
      paid_to:    payoutTo || undefined,
    });
    setShowPayout(false);
    setPayoutAmt(''); setPayoutReason(''); setPayoutTo('');
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Z-Report ${session?.session_date}</title>
      <style>
        body{font-family:'Courier New',monospace;font-size:12px;width:72mm;margin:0 auto;padding:4mm}
        .c{text-align:center}.b{font-weight:bold}.l{border-top:1px dashed #000;margin:4px 0}
        .r{display:flex;justify-content:space-between}
        h2{font-size:14px;text-align:center;margin:0 0 4px}
      </style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
              {ar ? 'اليوم مفتوح' : 'Day Open'}
            </p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {format(new Date(session!.session_date), 'EEEE, MMMM d, yyyy')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ar ? 'فُتح في' : 'Opened'} {format(new Date(session!.opened_at), 'h:mm a')}
            {' · '}{session?.transaction_count || 0} {ar ? 'معاملة' : 'transactions'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPayout(true)} className="gap-1.5 text-xs h-8">
            <Minus className="h-3.5 w-3.5" />{ar ? 'سحب نقدي' : 'Cash Payout'}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8">
            <Printer className="h-3.5 w-3.5" />{ar ? 'طباعة' : 'Print'}
          </Button>
          <Button size="sm" onClick={() => setShowClose(true)}
            className="gap-1.5 text-xs h-8 bg-red-600 hover:bg-red-700 text-white border-0">
            <DoorClosed className="h-3.5 w-3.5" />{ar ? 'إغلاق اليوم' : 'Close Day'}
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={ar ? 'إجمالي الإيرادات' : 'Total Revenue'} value={fmt(totalRevenue, currency)} icon={TrendingUp} color="text-emerald-600" highlight />
        <StatCard label={ar ? 'نقد في الصندوق (متوقع)' : 'Expected Cash'} value={fmt(expectedCash, currency)} sub={ar ? `رصيد افتتاح: ${fmt(session?.opening_balance, currency)}` : `Float: ${fmt(session?.opening_balance, currency)}`} icon={Banknote} color="text-primary" />
        <StatCard label={ar ? 'المعاملات' : 'Transactions'} value={String(session?.transaction_count || 0)} sub={ar ? 'مكتملة اليوم' : 'Completed today'} icon={Receipt} />
        <StatCard label={ar ? 'المسحوبات النقدية' : 'Cash Payouts'} value={fmt(totalPayouts, currency)} sub={`${(session?.payouts || []).length} ${ar ? 'سحب' : 'payouts'}`} icon={TrendingDown} color="text-amber-600" />
      </div>

      {/* Payment breakdown */}
      <Card className="border">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm">{ar ? 'توزيع المبيعات حسب طريقة الدفع' : 'Sales by Payment Method'}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: ar ? 'نقداً' : 'Cash',           val: liveCashSales, icon: Banknote,    color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
              { label: 'K-NET',                          val: liveKnetSales, icon: CreditCard,  color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
              { label: ar ? 'بطاقة ائتمان' : 'Card',    val: liveCardSales, icon: CreditCard,  color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-950/30' },
              { label: ar ? 'بطاقة هدية' : 'Gift Card', val: liveGiftSales, icon: Receipt,     color: 'text-pink-600',    bg: 'bg-pink-50 dark:bg-pink-950/30' },
            ].map(item => {
              const Icon = item.icon;
              const pct = totalRevenue > 0 ? Math.round((item.val / totalRevenue) * 100) : 0;
              return (
                <div key={item.label} className={cn('rounded-xl p-3.5 space-y-1', item.bg)}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">{item.label}</span>
                    <Icon className={cn('h-3.5 w-3.5', item.color)} />
                  </div>
                  <p className={cn('text-lg font-bold stat-number', item.color)}>{item.val.toFixed(3)}</p>
                  <div className="h-1 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', item.color.replace('text-','bg-'))} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{pct}% {ar ? 'من الإجمالي' : 'of total'}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payouts list */}
      {(session?.payouts || []).length > 0 && (
        <Card className="border">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm">{ar ? 'المسحوبات النقدية اليوم' : "Today's Cash Payouts"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(session?.payouts || []).map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 text-sm">
                <div>
                  <p className="font-medium">{p.reason}</p>
                  {p.paid_to && <p className="text-xs text-muted-foreground">{ar ? 'إلى:' : 'To:'} {p.paid_to}</p>}
                  <p className="text-xs text-muted-foreground">{format(new Date(p.payout_at), 'h:mm a')}</p>
                </div>
                <span className="font-bold text-amber-600">- {Number(p.amount).toFixed(3)} {currency}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Hidden Z-report for printing ── */}
      <div className="hidden">
        <div ref={printRef}>
          <h2>{session?.tenant_id ? 'ZAINA' : 'Salon'}</h2>
          <p className="c">Z-REPORT / تقرير إغلاق</p>
          <p className="c">{format(new Date(session!.session_date), 'dd/MM/yyyy')}</p>
          <div className="l" />
          <div className="r"><span>Opened / الافتتاح</span><span>{format(new Date(session!.opened_at), 'HH:mm')}</span></div>
          <div className="r"><span>Opening Float</span><span>{fmt(session?.opening_balance, currency)}</span></div>
          <div className="l" />
          <div className="r b"><span>Cash Sales</span><span>{fmt(liveCashSales, currency)}</span></div>
          <div className="r b"><span>K-NET Sales</span><span>{fmt(liveKnetSales, currency)}</span></div>
          <div className="r b"><span>Card Sales</span><span>{fmt(liveCardSales, currency)}</span></div>
          <div className="r b"><span>Gift Card</span><span>{fmt(liveGiftSales, currency)}</span></div>
          <div className="l" />
          <div className="r"><span>Cash Payouts</span><span>- {fmt(totalPayouts, currency)}</span></div>
          <div className="r"><span>Refunds (total)</span><span>- {fmt(liveRefunds, currency)}</span></div>
          {liveCashRefunds > 0 && (
            <div className="r" style={{ fontSize: 10 }}>
              <span>&nbsp;&nbsp;of which cash</span><span>- {fmt(liveCashRefunds, currency)}</span>
            </div>
          )}
          <div className="l" />
          <div className="r b"><span>TOTAL REVENUE</span><span>{fmt(totalRevenue, currency)}</span></div>
          <div className="r b"><span>Expected Cash</span><span>{fmt(expectedCash, currency)}</span></div>
          <div className="l" />
          <div className="r"><span>Transactions</span><span>{live?.txnCount ?? 0}</span></div>
          <p className="c" style={{ marginTop: 8, fontSize: 10 }}>Printed: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      </div>

      {/* ── Close Day Dialog ── */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <DoorClosed className="h-5 w-5" />
              {ar ? 'إغلاق يوم العمل' : 'Close Day'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* System totals summary */}
            <div className="rounded-xl bg-muted/40 border p-4 space-y-2 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {ar ? 'ملخص النظام' : 'System Summary'}
              </p>
              <div className="flex justify-between"><span className="text-muted-foreground">{ar ? 'رصيد الافتتاح' : 'Opening Float'}</span><span className="font-medium">{fmt(session?.opening_balance, currency)}</span></div>
              <div className="flex justify-between text-emerald-600"><span>{ar ? 'مبيعات نقدية' : 'Cash Sales'}</span><span className="font-bold">+ {fmt(liveCashSales, currency)}</span></div>
              <div className="flex justify-between text-blue-600"><span>K-NET</span><span className="font-bold">+ {fmt(liveKnetSales, currency)}</span></div>
              <div className="flex justify-between text-violet-600"><span>{ar ? 'بطاقة ائتمان' : 'Card'}</span><span className="font-bold">+ {fmt(liveCardSales, currency)}</span></div>
              {liveCashRefunds > 0 && <div className="flex justify-between text-red-600"><span>{ar ? 'استرداد نقدي' : 'Cash Refunds'}</span><span className="font-bold">- {fmt(liveCashRefunds, currency)}</span></div>}
              {totalPayouts > 0 && <div className="flex justify-between text-amber-600"><span>{ar ? 'مسحوبات نقدية' : 'Cash Payouts'}</span><span className="font-bold">- {fmt(totalPayouts, currency)}</span></div>}
              <Separator className="my-1" />
              <div className="flex justify-between font-bold text-base">
                <span>{ar ? 'النقد المتوقع في الصندوق' : 'Expected Cash'}</span>
                <span>{fmt(expectedCash, currency)}</span>
              </div>
            </div>

            {/* Physical counts */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? 'النقد الفعلي في الصندوق' : 'Cash Counted in Drawer'} * ({currency})
              </Label>
              <Input type="number" step="0.001" min="0" value={cashCounted}
                onChange={e => setCashCounted(e.target.value)}
                className="h-10 text-lg font-bold" placeholder="0.000" autoFocus />
              {/* Live variance */}
              {variance !== null && (
                <div className={cn(
                  'flex items-center gap-2 p-2.5 rounded-lg text-sm font-semibold',
                  Math.abs(variance) < 0.001
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : variance > 0
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                )}>
                  {Math.abs(variance) < 0.001 ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : variance > 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {Math.abs(variance) < 0.001
                    ? (ar ? 'الصندوق متطابق تماماً ✓' : 'Drawer balances perfectly ✓')
                    : variance > 0
                    ? `${ar ? 'زيادة' : 'Over'}: +${Math.abs(variance).toFixed(3)} ${currency}`
                    : `${ar ? 'عجز' : 'Short'}: -${Math.abs(variance).toFixed(3)} ${currency}`}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">K-NET Terminal Total ({currency})</Label>
                <Input type="number" step="0.001" min="0" value={knetTotal}
                  onChange={e => setKnetTotal(e.target.value)} className="h-9" placeholder="0.000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'إجمالي الكريدت كارد' : 'Credit Card Total'} ({currency})</Label>
                <Input type="number" step="0.001" min="0" value={cardTotal}
                  onChange={e => setCardTotal(e.target.value)} className="h-9" placeholder="0.000" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'ملاحظات الإغلاق' : 'Closing Notes'}</Label>
              <Textarea value={closeNotes} onChange={e => setCloseNotes(e.target.value)}
                rows={2} className="resize-none text-sm"
                placeholder={ar ? 'أي ملاحظات عند الإغلاق...' : 'Any notes for end of day...'} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowClose(false)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button size="sm" onClick={handleClose}
              disabled={closeDay.isPending || !cashCounted}
              className="gap-1.5 bg-red-600 hover:bg-red-700 text-white border-0">
              {closeDay.isPending
                ? <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><DoorClosed className="h-3.5 w-3.5" />{ar ? 'إغلاق اليوم' : 'Close Day'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cash Payout Dialog ── */}
      <Dialog open={showPayout} onOpenChange={setShowPayout}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Minus className="h-5 w-5 text-amber-600" />
              {ar ? 'سحب نقدي من الصندوق' : 'Cash Payout from Drawer'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'المبلغ' : 'Amount'} * ({currency})</Label>
              <Input type="number" step="0.001" min="0.001" value={payoutAmt}
                onChange={e => setPayoutAmt(e.target.value)} className="h-10" placeholder="0.000" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'السبب' : 'Reason'} *</Label>
              <Input value={payoutReason} onChange={e => setPayoutReason(e.target.value)}
                className="h-9" placeholder={ar ? 'مثال: مشتريات، فكة، مصروف...' : 'e.g. supplies, change, petty cash...'} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'صُرف إلى' : 'Paid to'} <span className="text-muted-foreground font-normal">{ar ? '(اختياري)' : '(optional)'}</span></Label>
              <Input value={payoutTo} onChange={e => setPayoutTo(e.target.value)}
                className="h-9" placeholder={ar ? 'اسم الشخص أو المورد' : 'Person or supplier name'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowPayout(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
            <Button size="sm" onClick={handlePayout}
              disabled={addPayout.isPending || !payoutAmt || !payoutReason}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-0">
              {addPayout.isPending
                ? <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Minus className="h-3.5 w-3.5" />{ar ? 'تسجيل السحب' : 'Record Payout'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Closed Session View ───────────────────────────────────────────

function ClosedSessionView({ session, currency }: { session: CashSession; currency: string }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const totalRevenue =
    Number(session.total_cash_sales) + Number(session.total_knet_sales) +
    Number(session.total_card_sales) + Number(session.total_gift_sales);
  const variance = Number(session.cash_variance || 0);

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-red-600">
              {ar ? 'اليوم مغلق' : 'Day Closed'}
            </p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {format(new Date(session.session_date), 'EEEE, MMMM d, yyyy')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ar ? 'أُغلق في' : 'Closed at'} {session.closed_at ? format(new Date(session.closed_at), 'h:mm a') : '—'}
          </p>
        </div>
        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800 h-7 px-3 text-xs font-bold">
          {ar ? 'مغلق' : 'CLOSED'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={ar ? 'إجمالي الإيرادات' : 'Total Revenue'} value={fmt(totalRevenue, currency)} icon={TrendingUp} color="text-emerald-600" highlight />
        <StatCard label={ar ? 'النقد المعدود' : 'Cash Counted'} value={fmt(session.closing_cash_counted, currency)} icon={Banknote} color="text-primary" />
        <StatCard label={ar ? 'الفارق' : 'Variance'}
          value={`${variance >= 0 ? '+' : ''}${variance.toFixed(3)} ${currency}`}
          icon={Math.abs(variance) < 0.001 ? CheckCircle2 : AlertTriangle}
          color={Math.abs(variance) < 0.001 ? 'text-emerald-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'} />
        <StatCard label={ar ? 'المعاملات' : 'Transactions'} value={String(session.transaction_count)} icon={Receipt} />
      </div>

      <Card className="border">
        <CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { l: ar ? 'مبيعات نقدية' : 'Cash Sales',   v: session.total_cash_sales },
            { l: 'K-NET',                               v: session.total_knet_sales },
            { l: ar ? 'بطاقة ائتمان' : 'Card',         v: session.total_card_sales },
            { l: 'K-NET Terminal',                      v: session.closing_knet_terminal },
          ].map(item => (
            <div key={item.l}>
              <p className="text-xs text-muted-foreground">{item.l}</p>
              <p className="font-bold">{fmt(item.v, currency)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────

function SessionHistoryView({ currency }: { currency: string }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const { data: history, isLoading } = useSessionHistory();

  if (isLoading) return <div className="p-6 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <h2 className="text-lg font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
        {ar ? 'سجل الجلسات (آخر 30 يوم)' : 'Session History (Last 30 days)'}
      </h2>
      {(!history || history.length === 0) ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <History className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">{ar ? 'لا توجد جلسات مسبقة' : 'No previous sessions'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(s => {
            const total = Number(s.total_cash_sales) + Number(s.total_knet_sales) + Number(s.total_card_sales) + Number(s.total_gift_sales);
            const variance = Number(s.cash_variance || 0);
            return (
              <div key={s.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
                <div className={cn('h-2 w-2 rounded-full flex-shrink-0', s.status === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{format(new Date(s.session_date), 'EEE, MMM d, yyyy')}</p>
                  <p className="text-xs text-muted-foreground">{s.transaction_count} {ar ? 'معاملة' : 'transactions'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold">{total.toFixed(3)} {currency}</p>
                  <p className={cn('text-xs', Math.abs(variance) < 0.001 ? 'text-emerald-600' : variance > 0 ? 'text-blue-600' : 'text-red-600')}>
                    {s.status === 'closed'
                      ? (Math.abs(variance) < 0.001 ? (ar ? 'متطابق' : 'Balanced') : `${variance > 0 ? '+' : ''}${variance.toFixed(3)}`)
                      : (ar ? 'مفتوح' : 'Open')}
                  </p>
                </div>
                <Badge variant="outline" className={cn('text-[9px] h-5 px-1.5 rounded-full font-bold flex-shrink-0',
                  s.status === 'open'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                    : 'bg-muted text-muted-foreground')}>
                  {s.status === 'open' ? (ar ? 'مفتوح' : 'Open') : (ar ? 'مغلق' : 'Closed')}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function DaySession() {
  const { language } = useLanguage();
  const { tenant } = useAuth();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';
  const [tab, setTab] = useState<'today' | 'history'>('today');

  const { data: session, isLoading } = useTodaySession();

  return (
    <div className="h-full flex flex-col bg-background" dir={ar ? 'rtl' : 'ltr'}>
      {/* Page header */}
      <div className="border-b bg-card px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
              {ar ? 'إدارة يوم العمل' : 'Day Session'}
            </h1>
            <p className="text-[11px] text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
        </div>
        <div className="flex gap-0.5 bg-muted p-0.5 rounded-lg">
          {[
            { id: 'today',   label: ar ? 'اليوم' : 'Today',   icon: Clock },
            { id: 'history', label: ar ? 'السجل' : 'History', icon: History },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                tab === t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'history' ? (
          <SessionHistoryView currency={currency} />
        ) : isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          </div>
        ) : !session ? (
          <OpenDayForm currency={currency} />
        ) : session.status === 'open' ? (
          <LiveSessionDashboard session={session} currency={currency} />
        ) : (
          <ClosedSessionView session={session} currency={currency} />
        )}
      </div>
    </div>
  );
}
