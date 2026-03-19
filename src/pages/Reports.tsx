import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Users,
  Download, ArrowUpRight, ArrowDownRight, Package,
  CreditCard, Scissors, Star, BarChart3, Activity,
  ShoppingBag, UserCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  format, subDays, startOfDay, endOfDay, eachDayOfInterval,
  startOfMonth, endOfMonth, subMonths, getHours, getDay,
} from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
type DateRange = '7d' | '30d' | '90d' | '1y';

function getBounds(range: DateRange) {
  const now = new Date();
  const days = { '7d': 6, '30d': 29, '90d': 89, '1y': 364 }[range];
  return { from: startOfDay(subDays(now, days)), to: endOfDay(now) };
}
function getPrevBounds(range: DateRange) {
  const { from, to } = getBounds(range);
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span), to: new Date(from.getTime()) };
}

const CHART_COLORS = {
  primary: 'hsl(345 65% 47%)',
  accent:  'hsl(38 72% 62%)',
  teal:    'hsl(175 60% 42%)',
  violet:  'hsl(263 65% 58%)',
  muted:   'hsl(220 16% 84%)',
};

const PIE_COLORS = ['#C0395E','#D4956A','#45A08C','#7C5CBF','#D98F3C','#3B82C4'];

const DAY_NAMES  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOUR_SLOTS = ['8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p'];

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useKPIs(tid?: string, range: DateRange = '7d') {
  const { from, to } = getBounds(range);
  const { from: pf, to: pt } = getPrevBounds(range);
  return useQuery({
    queryKey: ['kpis', tid, range],
    queryFn: async () => {
      const [curr, prev, bkgs, clients, noShows] = await Promise.all([
        supabase.from('transactions').select('grand_total,tip_amount,discount_amount')
          .eq('status','completed').gte('created_at',from.toISOString()).lte('created_at',to.toISOString()),
        supabase.from('transactions').select('grand_total')
          .eq('status','completed').gte('created_at',pf.toISOString()).lte('created_at',pt.toISOString()),
        supabase.from('bookings').select('id,status',{count:'exact'})
          .gte('created_at',from.toISOString()).lte('created_at',to.toISOString()),
        supabase.from('clients').select('id',{count:'exact',head:true})
          .gte('created_at',from.toISOString()).lte('created_at',to.toISOString()),
        supabase.from('bookings').select('id',{count:'exact',head:true})
          .eq('status','cancelled').gte('created_at',from.toISOString()).lte('created_at',to.toISOString()),
      ]);
      const rev  = (curr.data||[]).reduce((s,t)=>s+Number(t.grand_total),0);
      const pRev = (prev.data||[]).reduce((s,t)=>s+Number(t.grand_total),0);
      const tips = (curr.data||[]).reduce((s,t)=>s+Number(t.tip_amount),0);
      const disc = (curr.data||[]).reduce((s,t)=>s+Number(t.discount_amount),0);
      const txns  = curr.data?.length||0;
      const total = bkgs.count||0;
      const noShow= noShows.count||0;
      return {
        revenue:      Math.round(rev*1000)/1000,
        revChange:    pRev>0 ? Math.round(((rev-pRev)/pRev)*1000)/10 : 0,
        transactions: txns,
        avgTicket:    txns>0 ? Math.round((rev/txns)*1000)/1000 : 0,
        bookings:     total,
        noShowRate:   total>0 ? Math.round((noShow/total)*1000)/10 : 0,
        newClients:   clients.count||0,
        totalTips:    Math.round(tips*1000)/1000,
        totalDiscount:Math.round(disc*1000)/1000,
      };
    },
    enabled: !!tid,
  });
}

function useRevenueTrend(tid?: string, range: DateRange = '7d') {
  const { from, to } = getBounds(range);
  return useQuery({
    queryKey: ['rev-trend', tid, range],
    queryFn: async () => {
      const { data } = await supabase.from('transactions').select('grand_total,created_at')
        .eq('status','completed').gte('created_at',from.toISOString()).lte('created_at',to.toISOString());
      const days = eachDayOfInterval({ start: from, end: to });
      const map: Record<string,number> = {};
      days.forEach(d => { map[format(d,'yyyy-MM-dd')] = 0; });
      (data||[]).forEach(t => {
        const k = format(new Date(t.created_at),'yyyy-MM-dd');
        if (k in map) map[k] += Number(t.grand_total);
      });
      // running total for area chart
      let running = 0;
      return Object.entries(map).map(([date,rev]) => {
        running += rev;
        return {
          name: range==='7d' ? format(new Date(date),'EEE') : format(new Date(date),'MMM d'),
          revenue: Math.round(rev*1000)/1000,
          cumulative: Math.round(running*1000)/1000,
        };
      });
    },
    enabled: !!tid,
  });
}

function useMonthlyTrend(tid?: string) {
  return useQuery({
    queryKey: ['monthly-trend', tid],
    queryFn: async () => {
      const months = Array.from({length:6},(_,i)=>subMonths(new Date(),5-i));
      const rows = await Promise.all(months.map(async m => {
        const { data } = await supabase.from('transactions').select('grand_total')
          .eq('status','completed')
          .gte('created_at',startOfMonth(m).toISOString())
          .lte('created_at',endOfMonth(m).toISOString());
        return {
          name: format(m,'MMM'),
          revenue: Math.round((data||[]).reduce((s,t)=>s+Number(t.grand_total),0)*1000)/1000,
        };
      }));
      return rows;
    },
    enabled: !!tid,
  });
}

function usePaymentMethods(tid?: string, range: DateRange = '7d') {
  const { from, to } = getBounds(range);
  return useQuery({
    queryKey: ['payment-methods', tid, range],
    queryFn: async () => {
      const { data } = await supabase.from('transaction_payments').select('payment_method,amount')
        .gte('created_at',from.toISOString()).lte('created_at',to.toISOString());
      const map: Record<string,number> = {};
      (data||[]).forEach(p => {
        map[p.payment_method] = (map[p.payment_method]||0) + Number(p.amount);
      });
      const labels: Record<string,string> = { cash:'Cash', knet:'KNET', credit_card:'Credit Card', gift_card:'Gift Card' };
      return Object.entries(map).map(([k,v],i) => ({
        name: labels[k]||k, value: Math.round(v*1000)/1000,
        color: PIE_COLORS[i % PIE_COLORS.length],
      }));
    },
    enabled: !!tid,
  });
}

function useServiceBreakdown(tid?: string, range: DateRange = '7d') {
  const { from, to } = getBounds(range);
  return useQuery({
    queryKey: ['service-breakdown', tid, range],
    queryFn: async () => {
      const { data } = await supabase.from('transaction_items')
        .select('item_name,item_type,total_price,quantity')
        .eq('item_type','service')
        .gte('created_at',from.toISOString()).lte('created_at',to.toISOString());
      const map: Record<string,{rev:number;qty:number}> = {};
      (data||[]).forEach(i => {
        if (!map[i.item_name]) map[i.item_name]={rev:0,qty:0};
        map[i.item_name].rev += Number(i.total_price);
        map[i.item_name].qty += Number(i.quantity);
      });
      return Object.entries(map)
        .sort(([,a],[,b])=>b.rev-a.rev).slice(0,8)
        .map(([name,v],i) => ({
          name, revenue: Math.round(v.rev*1000)/1000,
          bookings: v.qty, color: PIE_COLORS[i%PIE_COLORS.length],
        }));
    },
    enabled: !!tid,
  });
}

function useServiceCategories(tid?: string, range: DateRange = '7d') {
  const { from, to } = getBounds(range);
  return useQuery({
    queryKey: ['service-cats', tid, range],
    queryFn: async () => {
      const { data } = await supabase.from('bookings')
        .select('service_category')
        .in('status',['completed','in_service'])
        .gte('created_at',from.toISOString()).lte('created_at',to.toISOString());
      const map: Record<string,number> = {};
      (data||[]).forEach(b => {
        map[b.service_category] = (map[b.service_category]||0)+1;
      });
      const labels: Record<string,{en:string;ar:string}> = {
        hair:    {en:'Hair',     ar:'شعر'},
        nails:   {en:'Nails',    ar:'أظافر'},
        facial:  {en:'Facial',   ar:'بشرة'},
        makeup:  {en:'Makeup',   ar:'مكياج'},
        waxing:  {en:'Waxing',   ar:'إزالة شعر'},
        massage: {en:'Massage',  ar:'مساج'},
        other:   {en:'Other',    ar:'أخرى'},
      };
      return Object.entries(map).map(([k,v],i)=>({
        name: labels[k]?.en||k, nameAr: labels[k]?.ar||k,
        value: v, color: PIE_COLORS[i%PIE_COLORS.length],
      }));
    },
    enabled: !!tid,
  });
}

function useStaffPerformance(tid?: string, range: DateRange = '7d') {
  const { from, to } = getBounds(range);
  return useQuery({
    queryKey: ['staff-perf', tid, range],
    queryFn: async () => {
      const { data } = await supabase.from('transactions')
        .select('grand_total,tip_amount,staff_id,staff:staff_id(name)')
        .eq('status','completed')
        .not('staff_id','is',null)
        .gte('created_at',from.toISOString()).lte('created_at',to.toISOString());
      const map: Record<string,{name:string;rev:number;tips:number;txns:number}> = {};
      (data||[]).forEach((t:any) => {
        const id = t.staff_id as string;
        if (!map[id]) map[id]={name:t.staff?.name||'Unknown',rev:0,tips:0,txns:0};
        map[id].rev  += Number(t.grand_total);
        map[id].tips += Number(t.tip_amount);
        map[id].txns += 1;
      });
      const rows = Object.values(map).sort((a,b)=>b.rev-a.rev);
      const maxRev = Math.max(...rows.map(r=>r.rev),1);
      return rows.map(r=>({
        ...r,
        revenue:  Math.round(r.rev*1000)/1000,
        tips:     Math.round(r.tips*1000)/1000,
        avgTicket:r.txns>0 ? Math.round((r.rev/r.txns)*1000)/1000 : 0,
        pct:      Math.round((r.rev/maxRev)*100),
      }));
    },
    enabled: !!tid,
  });
}

function usePeakHours(tid?: string, range: DateRange = '7d') {
  const { from, to } = getBounds(range);
  return useQuery({
    queryKey: ['peak-hours', tid, range],
    queryFn: async () => {
      const { data } = await supabase.from('bookings')
        .select('start_time,booking_date')
        .in('status',['completed','in_service','confirmed'])
        .gte('booking_date',format(from,'yyyy-MM-dd'))
        .lte('booking_date',format(to,'yyyy-MM-dd'));
      // Build 7×13 heatmap (days × hours 8am–8pm)
      const grid: number[][] = Array.from({length:7},()=>Array(13).fill(0));
      (data||[]).forEach(b => {
        if (!b.start_time || !b.booking_date) return;
        const h = parseInt(b.start_time.slice(0,2),10);
        const d = getDay(new Date(b.booking_date));
        const slot = h-8;
        if (slot>=0 && slot<13) grid[d][slot]++;
      });
      return grid;
    },
    enabled: !!tid,
  });
}

function useClientRetention(tid?: string, range: DateRange = '30d') {
  const { from, to } = getBounds(range);
  return useQuery({
    queryKey: ['client-retention', tid, range],
    queryFn: async () => {
      const { data } = await supabase.from('bookings')
        .select('client_id,booking_date')
        .not('client_id','is',null)
        .in('status',['completed','in_service'])
        .gte('booking_date',format(subDays(to,180),'yyyy-MM-dd'))
        .lte('booking_date',format(to,'yyyy-MM-dd'));
      const clientVisits: Record<string,string[]> = {};
      (data||[]).forEach(b => {
        if (!clientVisits[b.client_id!]) clientVisits[b.client_id!]=[];
        clientVisits[b.client_id!].push(b.booking_date);
      });
      const total   = Object.keys(clientVisits).length;
      const returning = Object.values(clientVisits).filter(v=>v.length>1).length;
      const newC    = total - returning;
      const retRate = total>0 ? Math.round((returning/total)*100) : 0;
      const avgVisits = total>0 ? Math.round((Object.values(clientVisits).reduce((s,v)=>s+v.length,0)/total)*10)/10 : 0;
      return { total, returning, newC, retRate, avgVisits };
    },
    enabled: !!tid,
  });
}

function useInventoryReport(tid?: string) {
  return useQuery({
    queryKey: ['inv-report', tid],
    queryFn: async () => {
      const { data: products } = await supabase.from('products')
        .select('id,name,current_stock,reorder_point,cost_price,selling_price,unit');
      const { data: movements } = await supabase.from('inventory_transactions')
        .select('product_id,quantity_change,transaction_type')
        .gte('created_at', subDays(new Date(),30).toISOString());
      const usageMap: Record<string,number> = {};
      (movements||[]).forEach(m => {
        if (m.transaction_type === 'usage') {
          usageMap[m.product_id] = (usageMap[m.product_id]||0) + Math.abs(m.quantity_change);
        }
      });
      const rows = (products||[]).map(p => ({
        ...p,
        monthlyUsage: usageMap[p.id]||0,
        stockValue: (p.current_stock||0) * Number(p.cost_price||0),
        isLow: (p.current_stock||0) <= (p.reorder_point||0),
      })).sort((a,b)=>b.monthlyUsage - a.monthlyUsage);
      const totalValue = rows.reduce((s,p)=>s+p.stockValue,0);
      const lowStockCount = rows.filter(p=>p.isLow).length;
      return { rows, totalValue: Math.round(totalValue*1000)/1000, lowStockCount };
    },
    enabled: !!tid,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, trend, loading }: any) {
  const up = trend >= 0;
  return (
    <Card className="kpi-card border">
      <CardContent className="p-5">
        {loading ? (
          <><Skeleton className="h-3 w-24 mb-3"/><Skeleton className="h-8 w-28 mb-2"/><Skeleton className="h-3 w-20"/></>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <p className="stat-number text-2xl font-bold tracking-tight">{value}</p>
            {trend !== undefined ? (
              <div className={cn('flex items-center gap-1 mt-1.5 text-[11px] font-medium', up ? 'text-emerald-600' : 'text-red-500')}>
                {up ? <ArrowUpRight className="h-3 w-3"/> : <ArrowDownRight className="h-3 w-3"/>}
                {Math.abs(trend)}% vs prior period
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1 text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{color: p.color}} className="font-medium">
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? `${p.value.toFixed(3)} ${currency}` : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Reports() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [range, setRange] = useState<DateRange>('30d');
  const currency = tenant?.currency || 'KWD';
  const tid = tenant?.id;

  const { data: kpis,   isLoading: kpisL   } = useKPIs(tid, range);
  const { data: trend,  isLoading: trendL  } = useRevenueTrend(tid, range);
  const { data: monthly                     } = useMonthlyTrend(tid);
  const { data: payments                    } = usePaymentMethods(tid, range);
  const { data: services, isLoading: svcL  } = useServiceBreakdown(tid, range);
  const { data: cats                        } = useServiceCategories(tid, range);
  const { data: staff, isLoading: staffL   } = useStaffPerformance(tid, range);
  const { data: heatmap                     } = usePeakHours(tid, range);
  const { data: retention                   } = useClientRetention(tid, range);
  const { data: inventory                   } = useInventoryReport(tid);

  const maxHeat = useMemo(() => heatmap ? Math.max(...heatmap.flat(), 1) : 1, [heatmap]);

  const heatColor = (val: number) => {
    if (val === 0) return 'bg-muted/40';
    const pct = val / maxHeat;
    if (pct < 0.25) return 'bg-primary/15';
    if (pct < 0.50) return 'bg-primary/35';
    if (pct < 0.75) return 'bg-primary/60';
    return 'bg-primary';
  };

  const t = (en: string, arStr: string) => ar ? arStr : en;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">
            {t('Business Intelligence','تقارير الأعمال')}
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{fontFamily:'Syne,sans-serif'}}>
            {t('Reports & Analytics','التقارير والتحليلات')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('Real-time insights from your salon data','رؤى فورية من بيانات صالونك')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={v => setRange(v as DateRange)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('Last 7 days','آخر 7 أيام')}</SelectItem>
              <SelectItem value="30d">{t('Last 30 days','آخر 30 يوم')}</SelectItem>
              <SelectItem value="90d">{t('Last 90 days','آخر 90 يوم')}</SelectItem>
              <SelectItem value="1y">{t('Last 12 months','آخر 12 شهر')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />{t('Export','تصدير')}
          </Button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label={t('Total Revenue','إجمالي الإيرادات')}  value={`${kpis?.revenue.toFixed(3)||0} ${currency}`}  trend={kpis?.revChange}   icon={DollarSign}  loading={kpisL} />
        <KPICard label={t('Transactions','المعاملات')}           value={kpis?.transactions||0}                          sub={t('Completed sales','مبيعات مكتملة')}   icon={CreditCard}  loading={kpisL} />
        <KPICard label={t('Avg. Ticket','متوسط الفاتورة')}      value={`${kpis?.avgTicket?.toFixed(3)||0} ${currency}`} sub={t('Per transaction','لكل معاملة')}   icon={BarChart3}   loading={kpisL} />
        <KPICard label={t('New Clients','عميلات جدد')}          value={kpis?.newClients||0}                            sub={t('Joined in period','انضممن في الفترة')} icon={Users}       loading={kpisL} />
      </div>

      {/* Second KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label={t('Tips Collected','الإكراميات')}       value={`${kpis?.totalTips?.toFixed(3)||0} ${currency}`}    sub={t('From all staff','من جميع الموظفات')}  icon={Star}       loading={kpisL} />
        <KPICard label={t('Discounts Given','الخصومات')}        value={`${kpis?.totalDiscount?.toFixed(3)||0} ${currency}`} sub={t('Total discounted','إجمالي الخصم')} icon={TrendingDown} loading={kpisL} />
        <KPICard label={t('Total Bookings','إجمالي الحجوزات')} value={kpis?.bookings||0}                                    sub={t('All statuses','جميع الحالات')}      icon={Calendar}   loading={kpisL} />
        <KPICard label={t('Cancellation Rate','معدل الإلغاء')} value={`${kpis?.noShowRate||0}%`}                           sub={t('Of all bookings','من الحجوزات')}    icon={Activity}   loading={kpisL} />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="h-9 text-xs gap-0.5">
          <TabsTrigger value="revenue"  className="text-xs px-3">{t('Revenue','الإيرادات')}</TabsTrigger>
          <TabsTrigger value="services" className="text-xs px-3">{t('Services','الخدمات')}</TabsTrigger>
          <TabsTrigger value="staff"    className="text-xs px-3">{t('Staff','الموظفات')}</TabsTrigger>
          <TabsTrigger value="clients"  className="text-xs px-3">{t('Clients','العميلات')}</TabsTrigger>
          <TabsTrigger value="inventory"className="text-xs px-3">{t('Inventory','المخزون')}</TabsTrigger>
        </TabsList>

        {/* ── Revenue Tab ── */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Area chart */}
            <Card className="border lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t('Revenue Over Time','الإيرادات عبر الزمن')}</CardTitle>
                <CardDescription className="text-xs">{t('Daily revenue with cumulative total','الإيرادات اليومية مع الإجمالي التراكمي')}</CardDescription>
              </CardHeader>
              <CardContent>
                {trendL ? <Skeleton className="h-64 w-full"/> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={CHART_COLORS.primary} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={CHART_COLORS.accent} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{fontSize:11}} />
                      <YAxis tick={{fontSize:11}} />
                      <Tooltip content={<CustomTooltip currency={currency}/>} />
                      <Area type="monotone" dataKey="revenue" name={t('Daily','يومي')} stroke={CHART_COLORS.primary} fill="url(#revGrad)" strokeWidth={2}/>
                      <Area type="monotone" dataKey="cumulative" name={t('Cumulative','تراكمي')} stroke={CHART_COLORS.accent} fill="url(#cumGrad)" strokeWidth={1.5} strokeDasharray="4 2"/>
                      <Legend wrapperStyle={{fontSize:11}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Monthly bar chart */}
            <Card className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t('6-Month Trend','اتجاه 6 أشهر')}</CardTitle>
                <CardDescription className="text-xs">{t('Monthly revenue comparison','مقارنة الإيرادات الشهرية')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                    <XAxis dataKey="name" tick={{fontSize:11}}/>
                    <YAxis tick={{fontSize:11}}/>
                    <Tooltip content={<CustomTooltip currency={currency}/>}/>
                    <Bar dataKey="revenue" name={t('Revenue','الإيرادات')} fill={CHART_COLORS.primary} radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment methods */}
            <Card className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t('Payment Methods','طرق الدفع')}</CardTitle>
                <CardDescription className="text-xs">{t('Revenue split by payment type','توزيع الإيرادات حسب طريقة الدفع')}</CardDescription>
              </CardHeader>
              <CardContent>
                {!payments?.length ? (
                  <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">{t('No data','لا توجد بيانات')}</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={200}>
                      <PieChart>
                        <Pie data={payments} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                          {payments.map((p,i)=><Cell key={i} fill={p.color}/>)}
                        </Pie>
                        <Tooltip content={<CustomTooltip currency={currency}/>}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 flex-1">
                      {payments.map(p => (
                        <div key={p.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full" style={{background:p.color}}/>
                            <span className="text-muted-foreground">{p.name}</span>
                          </div>
                          <span className="font-semibold">{p.value.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Services Tab ── */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Category pie */}
            <Card className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t('By Category','حسب الفئة')}</CardTitle>
                <CardDescription className="text-xs">{t('Bookings per service category','الحجوزات حسب فئة الخدمة')}</CardDescription>
              </CardHeader>
              <CardContent>
                {!cats?.length ? (
                  <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">{t('No data','لا توجد بيانات')}</div>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie data={cats} dataKey="value" nameKey={ar?'nameAr':'name'} cx="50%" cy="50%" outerRadius={90} paddingAngle={2}>
                        {cats.map((c,i)=><Cell key={i} fill={c.color}/>)}
                      </Pie>
                      <Tooltip/>
                      <Legend wrapperStyle={{fontSize:11}}/>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top services table */}
            <Card className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t('Top Services','أفضل الخدمات')}</CardTitle>
                <CardDescription className="text-xs">{t('By revenue in selected period','حسب الإيرادات في الفترة المحددة')}</CardDescription>
              </CardHeader>
              <CardContent>
                {svcL ? (
                  <div className="space-y-2">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
                ) : services?.length ? (
                  <div className="space-y-2">
                    {services.map((s,i) => {
                      const maxRev = services[0].revenue || 1;
                      return (
                        <div key={s.name} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-muted-foreground w-4">{i+1}</span>
                              <span className="text-xs font-medium truncate max-w-[140px]">{s.name}</span>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{s.bookings}x</Badge>
                            </div>
                            <span className="text-xs font-bold">{s.revenue.toFixed(3)} {currency}</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{width:`${(s.revenue/maxRev)*100}%`, background:s.color}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">{t('No service data','لا توجد بيانات')}</div>
                )}
              </CardContent>
            </Card>

            {/* Peak hours heatmap */}
            <Card className="border lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t('Peak Hours Heatmap','خريطة أوقات الذروة')}</CardTitle>
                <CardDescription className="text-xs">{t('Booking intensity by day and hour','كثافة الحجوزات حسب اليوم والساعة')}</CardDescription>
              </CardHeader>
              <CardContent>
                {!heatmap ? <Skeleton className="h-40 w-full"/> : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[520px]">
                      {/* Hour labels */}
                      <div className="flex ml-8 mb-1 gap-0.5">
                        {HOUR_SLOTS.map(h=>(
                          <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">{h}</div>
                        ))}
                      </div>
                      {/* Grid */}
                      {heatmap.map((row, di) => (
                        <div key={di} className="flex items-center gap-0.5 mb-0.5">
                          <span className="text-[9px] text-muted-foreground w-7 text-right pr-1">{DAY_NAMES[di]}</span>
                          {row.map((val, hi) => (
                            <div
                              key={hi}
                              title={`${DAY_NAMES[di]} ${HOUR_SLOTS[hi]}: ${val} bookings`}
                              className={cn('flex-1 h-6 rounded-sm transition-colors', heatColor(val))}
                            />
                          ))}
                        </div>
                      ))}
                      {/* Legend */}
                      <div className="flex items-center gap-1 mt-2 justify-end">
                        <span className="text-[9px] text-muted-foreground mr-1">{t('Less','أقل')}</span>
                        {['bg-muted/40','bg-primary/15','bg-primary/35','bg-primary/60','bg-primary'].map((c,i)=>(
                          <div key={i} className={cn('h-4 w-4 rounded-sm', c)}/>
                        ))}
                        <span className="text-[9px] text-muted-foreground ml-1">{t('More','أكثر')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Staff Tab ── */}
        <TabsContent value="staff" className="space-y-4">
          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('Staff Performance','أداء الموظفات')}</CardTitle>
              <CardDescription className="text-xs">{t('Revenue, tips and transactions per staff member','الإيرادات والإكراميات والمعاملات لكل موظفة')}</CardDescription>
            </CardHeader>
            <CardContent>
              {staffL ? (
                <div className="space-y-3">{[...Array(4)].map((_,i)=><Skeleton key={i} className="h-14 w-full"/>)}</div>
              ) : staff?.length ? (
                <>
                  {/* Bar chart */}
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={staff} layout="vertical" margin={{left:60}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                      <XAxis type="number" tick={{fontSize:10}}/>
                      <YAxis dataKey="name" type="category" tick={{fontSize:11}} width={60}/>
                      <Tooltip content={<CustomTooltip currency={currency}/>}/>
                      <Bar dataKey="revenue" name={t('Revenue','الإيرادات')} fill={CHART_COLORS.primary} radius={[0,4,4,0]}/>
                      <Bar dataKey="tips" name={t('Tips','إكراميات')} fill={CHART_COLORS.accent} radius={[0,4,4,0]}/>
                      <Legend wrapperStyle={{fontSize:11}}/>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Table */}
                  <div className="mt-4 overflow-x-auto rounded-lg border border-border/50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left py-2.5 px-4 font-semibold">{t('Staff','الموظفة')}</th>
                          <th className="text-right py-2.5 px-4 font-semibold">{t('Txns','المعاملات')}</th>
                          <th className="text-right py-2.5 px-4 font-semibold">{t('Revenue','الإيرادات')}</th>
                          <th className="text-right py-2.5 px-4 font-semibold">{t('Avg Ticket','متوسط الفاتورة')}</th>
                          <th className="text-right py-2.5 px-4 font-semibold">{t('Tips','الإكراميات')}</th>
                          <th className="py-2.5 px-4 font-semibold">{t('Share','الحصة')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staff.map((s,i) => (
                          <tr key={s.name} className={cn('border-b last:border-0 hover:bg-muted/20', i===0&&'bg-primary/3')}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {i===0 && <Star className="h-3 w-3 text-amber-500"/>}
                                <span className="font-medium">{s.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">{s.txns}</td>
                            <td className="py-3 px-4 text-right font-semibold">{s.revenue.toFixed(3)} {currency}</td>
                            <td className="py-3 px-4 text-right">{s.avgTicket.toFixed(3)}</td>
                            <td className="py-3 px-4 text-right text-emerald-600">{s.tips.toFixed(3)}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{width:`${s.pct}%`}}/>
                                </div>
                                <span className="text-[10px] text-muted-foreground w-8 text-right">{s.pct}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">{t('No staff data','لا توجد بيانات')}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Clients Tab ── */}
        <TabsContent value="clients" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('Total Clients','إجمالي العميلات'), val: retention?.total||0,     icon: Users,      color: 'text-primary' },
              { label: t('Returning','العائدات'),            val: retention?.returning||0, icon: UserCheck,  color: 'text-emerald-500' },
              { label: t('New','جدد'),                       val: retention?.newC||0,      icon: Users,      color: 'text-blue-500' },
              { label: t('Retention Rate','معدل الاحتفاظ'), val: `${retention?.retRate||0}%`, icon: TrendingUp, color: 'text-amber-500' },
            ].map(({ label, val, icon: Icon, color }) => (
              <Card key={label} className="kpi-card border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <Icon className={cn('h-4 w-4', color)} />
                  </div>
                  <p className="stat-number text-2xl font-bold">{val}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('Client Retention Overview','نظرة عامة على الاحتفاظ بالعميلات')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Donut */}
                {retention && (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={180}>
                      <PieChart>
                        <Pie
                          data={[
                            {name:t('Returning','عائدات'), value:retention.returning, fill:CHART_COLORS.primary},
                            {name:t('New','جدد'),          value:retention.newC,       fill:CHART_COLORS.muted},
                          ]}
                          cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value"
                        >
                          <Cell fill={CHART_COLORS.primary}/>
                          <Cell fill={CHART_COLORS.muted}/>
                        </Pie>
                        <Tooltip/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3 flex-1">
                      {[
                        { label: t('Returning clients','عميلات عائدات'), val: retention.returning, color: CHART_COLORS.primary },
                        { label: t('New clients','عميلات جدد'),           val: retention.newC,       color: CHART_COLORS.muted },
                      ].map(row => (
                        <div key={row.label}>
                          <div className="flex justify-between mb-1 text-xs">
                            <span className="text-muted-foreground">{row.label}</span>
                            <span className="font-semibold">{row.val}</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{width:`${retention.total>0?(row.val/retention.total)*100:0}%`, background:row.color}}/>
                          </div>
                        </div>
                      ))}
                      <div className="mt-3 p-3 rounded-lg bg-muted/40 text-xs">
                        <p className="text-muted-foreground">{t('Avg. visits per client','متوسط الزيارات للعميلة')}</p>
                        <p className="text-xl font-bold mt-0.5 stat-number">{retention.avgVisits}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Inventory Tab ── */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: t('Total Products','إجمالي المنتجات'), val: inventory?.rows.length||0,     icon: Package,   color:'text-primary' },
              { label: t('Stock Value','قيمة المخزون'),       val: `${inventory?.totalValue.toFixed(3)||0} ${currency}`, icon: DollarSign, color:'text-emerald-500' },
              { label: t('Low Stock Items','منتجات شحيحة'),    val: inventory?.lowStockCount||0,   icon: Activity,  color:'text-red-500' },
            ].map(({ label, val, icon: Icon, color }) => (
              <Card key={label} className="kpi-card border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className={cn('h-4 w-4', color)} />
                  </div>
                  <div>
                    <p className="stat-number text-xl font-bold">{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('Product Stock Report','تقرير مخزون المنتجات')}</CardTitle>
              <CardDescription className="text-xs">{t('Sorted by monthly usage','مرتبة حسب الاستخدام الشهري')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!inventory ? <Skeleton className="h-64 w-full"/> : (
                <div className="overflow-x-auto rounded-lg border border-border/50">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left py-2.5 px-4 font-semibold">{t('Product','المنتج')}</th>
                        <th className="text-right py-2.5 px-4 font-semibold">{t('In Stock','المخزون')}</th>
                        <th className="text-right py-2.5 px-4 font-semibold">{t('Reorder At','إعادة الطلب')}</th>
                        <th className="text-right py-2.5 px-4 font-semibold">{t('30d Usage','استخدام 30 يوم')}</th>
                        <th className="text-right py-2.5 px-4 font-semibold">{t('Value','القيمة')}</th>
                        <th className="text-center py-2.5 px-4 font-semibold">{t('Status','الحالة')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.rows.slice(0,20).map((p,i) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2.5 px-4 font-medium">{p.name}</td>
                          <td className="py-2.5 px-4 text-right">{p.current_stock} {p.unit||''}</td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground">{p.reorder_point||0}</td>
                          <td className="py-2.5 px-4 text-right">{p.monthlyUsage}</td>
                          <td className="py-2.5 px-4 text-right">{p.stockValue.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4 rounded-full font-semibold',
                              p.isLow
                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
                            )}>
                              {p.isLow ? t('Low','شحيح') : t('OK','طبيعي')}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
