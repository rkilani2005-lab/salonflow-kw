import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProfitLoss } from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { exportCSV } from '@/lib/exportUtils';
import { Download, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Period = 'this_month' | 'last_month' | 'q1' | 'q2' | 'q3' | 'q4' | 'ytd';

function getPeriodDates(p: Period): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  switch (p) {
    case 'this_month': return { from: format(startOfMonth(now),'yyyy-MM-dd'), to: format(endOfMonth(now),'yyyy-MM-dd'), label: format(now,'MMMM yyyy') };
    case 'last_month': { const lm = subMonths(now,1); return { from: format(startOfMonth(lm),'yyyy-MM-dd'), to: format(endOfMonth(lm),'yyyy-MM-dd'), label: format(lm,'MMMM yyyy') }; }
    case 'q1': return { from: `${y}-01-01`, to: `${y}-03-31`, label: `Q1 ${y}` };
    case 'q2': return { from: `${y}-04-01`, to: `${y}-06-30`, label: `Q2 ${y}` };
    case 'q3': return { from: `${y}-07-01`, to: `${y}-09-30`, label: `Q3 ${y}` };
    case 'q4': return { from: `${y}-10-01`, to: `${y}-12-31`, label: `Q4 ${y}` };
    case 'ytd': return { from: `${y}-01-01`, to: format(now,'yyyy-MM-dd'), label: `YTD ${y}` };
  }
}

function LineRow({ label, amount, bold, indent, currency, positive, negative }: { label:string; amount:number; bold?:boolean; indent?:boolean; currency:string; positive?:boolean; negative?:boolean }) {
  const color = positive && amount > 0 ? 'text-emerald-600' : negative && amount < 0 ? 'text-red-500' : '';
  return (
    <div className={cn('flex items-center justify-between py-2 px-4 rounded-lg', bold && 'bg-muted/40', indent && 'pl-8')}>
      <span className={cn('text-sm', bold && 'font-bold', !bold && 'text-muted-foreground')}>{label}</span>
      <span className={cn('text-sm font-semibold tabular-nums', bold && 'text-base', color)}>
        {amount >= 0 ? '' : '-'}{Math.abs(amount).toFixed(3)} {currency}
      </span>
    </div>
  );
}

export default function ProfitLoss() {
  const { language } = useLanguage();
  const { tenant } = useAuth();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';
  const [period, setPeriod] = useState<Period>('this_month');
  const { from, to, label } = getPeriodDates(period);
  const { data, isLoading } = useProfitLoss(from, to);

  const chartData = data ? [
    { name: ar ? 'الإيرادات' : 'Revenue',      value: data.totalRevenue,  fill: '#10b981' },
    { name: ar ? 'تكلفة الخدمات' : 'COGS',    value: data.totalCogs,     fill: '#f59e0b' },
    { name: ar ? 'مصروفات التشغيل' : 'OpEx',   value: data.totalOpex,     fill: '#ef4444' },
    { name: ar ? 'صافي الربح' : 'Net Income',  value: data.netIncome,     fill: '#6366f1' },
  ] : [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">{ar?'قائمة المركز المالي':'Financial Statement'}</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>{ar?'قائمة الدخل':'Profit & Loss'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">{ar?'هذا الشهر':'This Month'}</SelectItem>
              <SelectItem value="last_month">{ar?'الشهر الماضي':'Last Month'}</SelectItem>
              <SelectItem value="q1">Q1</SelectItem><SelectItem value="q2">Q2</SelectItem>
              <SelectItem value="q3">Q3</SelectItem><SelectItem value="q4">Q4</SelectItem>
              <SelectItem value="ytd">{ar?'من بداية العام':'Year-to-Date'}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={() => {
              if (!data) return;
              const rows = [
                ...data.revenue.map((a: any) => ({ section: 'Revenue', account: a.name, amount: a.amount.toFixed(3) })),
                ...data.cogs.map((a: any) => ({ section: 'COGS', account: a.name, amount: a.amount.toFixed(3) })),
                ...data.opex.map((a: any) => ({ section: 'OpEx', account: a.name, amount: a.amount.toFixed(3) })),
                { section: 'TOTAL', account: 'Net Income', amount: data.netIncome.toFixed(3) },
              ];
              exportCSV(rows, `pnl_${label.replace(/\s/g,'_')}`, { section: 'Section', account: 'Account', amount: `Amount (${currency})` });
            }}>
            <Download className="h-3.5 w-3.5"/>{ar?'تصدير':'Export'}
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: ar?'إجمالي الإيرادات':'Total Revenue', val: data?.totalRevenue??0, icon: TrendingUp, color: 'text-emerald-500' },
          { label: ar?'تكلفة الخدمات':'Cost of Services', val: data?.totalCogs??0,   icon: TrendingDown, color: 'text-amber-500' },
          { label: ar?'الربح الإجمالي':'Gross Profit',   val: data?.grossProfit??0,  icon: DollarSign, color: 'text-primary' },
          { label: ar?'صافي الربح':'Net Income',          val: data?.netIncome??0,    icon: BarChart3, color: (data?.netIncome??0)>=0?'text-emerald-500':'text-red-500' },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label} className="kpi-card border">
            <CardContent className="p-4">
              {isLoading ? <Skeleton className="h-14 w-full" /> : (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <Icon className={cn('h-4 w-4', color)} />
                  </div>
                  <p className="stat-number text-xl font-bold">{Math.abs(val).toFixed(3)} {currency}</p>
                  {val < 0 && <p className="text-[10px] text-red-500 mt-0.5">{ar?'خسارة':'Loss'}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* P&L Statement */}
        <Card className="border lg:col-span-3">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm">{ar?'قائمة الدخل التفصيلية':'Detailed Income Statement'}</CardTitle>
            <CardDescription className="text-xs">{label}</CardDescription>
          </CardHeader>
          <CardContent className="p-3 space-y-1">
            {isLoading ? <Skeleton className="h-64 w-full" /> : !data ? null : (
              <>
                <LineRow label={ar?'الإيرادات':'REVENUE'} amount={0} bold currency={currency} />
                {data.revenue.map(a => <LineRow key={a.id} label={ar&&a.name_ar?a.name_ar:a.name} amount={a.amount} indent currency={currency} />)}
                <LineRow label={ar?'إجمالي الإيرادات':'Total Revenue'} amount={data.totalRevenue} bold currency={currency} positive />

                <div className="h-px bg-border my-2" />
                <LineRow label={ar?'تكلفة الخدمات (COGS)':'COST OF SERVICES (COGS)'} amount={0} bold currency={currency} />
                {data.cogs.map(a => <LineRow key={a.id} label={ar&&a.name_ar?a.name_ar:a.name} amount={a.amount} indent currency={currency} />)}
                <LineRow label={ar?'إجمالي التكلفة':'Total COGS'} amount={data.totalCogs} bold currency={currency} />
                <LineRow label={ar?'مجمل الربح':'GROSS PROFIT'} amount={data.grossProfit} bold currency={currency} positive={data.grossProfit>=0} negative={data.grossProfit<0} />

                <div className="h-px bg-border my-2" />
                <LineRow label={ar?'مصروفات التشغيل':'OPERATING EXPENSES'} amount={0} bold currency={currency} />
                {data.opex.map(a => <LineRow key={a.id} label={ar&&a.name_ar?a.name_ar:a.name} amount={a.amount} indent currency={currency} />)}
                <LineRow label={ar?'إجمالي مصروفات التشغيل':'Total Operating Expenses'} amount={data.totalOpex} bold currency={currency} />

                <div className="h-px bg-border my-2" />
                <div className={cn('flex items-center justify-between py-3 px-4 rounded-xl border-2', data.netIncome>=0?'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20':'border-red-200 bg-red-50 dark:bg-red-900/20')}>
                  <span className="font-bold">{ar?'صافي الربح (الخسارة)':'NET INCOME (LOSS)'}</span>
                  <span className={cn('font-bold text-lg stat-number', data.netIncome>=0?'text-emerald-600':'text-red-600')}>
                    {data.netIncome<0?'-':''}{Math.abs(data.netIncome).toFixed(3)} {currency}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 pt-1">
                  <span className="text-xs text-muted-foreground">{ar?'هامش صافي الربح':'Net Margin'}</span>
                  <span className="text-xs font-semibold">{data.totalRevenue>0?Math.round((data.netIncome/data.totalRevenue)*1000)/10:0}%</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{ar?'ملخص بياني':'Visual Summary'}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64 w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: number) => `${Math.abs(v).toFixed(3)} ${currency}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((e, i) => <rect key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
