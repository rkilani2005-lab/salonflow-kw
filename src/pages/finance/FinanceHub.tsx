import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFinanceKPIs } from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, BookOpen,
  Receipt, FileText, CreditCard, BarChart3, PiggyBank,
  Megaphone, ArrowUpRight, ArrowDownRight, Calculator, Landmark, GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps { label: string; value: string; sub?: string; icon: React.ComponentType<{className?:string}>; trend?: number; color?: string; loading: boolean; onClick?: () => void; }
function KPICard({ label, value, sub, icon: Icon, trend, color='text-primary', loading, onClick }: KPICardProps) {
  return (
    <Card className={cn('kpi-card border', onClick && 'cursor-pointer card-hover')} onClick={onClick}>
      <CardContent className="p-5">
        {loading ? (<><Skeleton className="h-3 w-24 mb-3"/><Skeleton className="h-8 w-28 mb-2"/><Skeleton className="h-3 w-20"/></>) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <div className={cn('h-7 w-7 rounded-md flex items-center justify-center bg-muted')}><Icon className={cn('h-3.5 w-3.5', color)}/></div>
            </div>
            <p className="stat-number text-2xl font-bold tracking-tight">{value}</p>
            {trend !== undefined ? (
              <div className={cn('flex items-center gap-1 mt-1.5 text-[11px] font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {trend >= 0 ? <ArrowUpRight className="h-3 w-3"/> : <ArrowDownRight className="h-3 w-3"/>}
                {Math.abs(trend)}% vs last month
              </div>
            ) : sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const FINANCE_MODULES = [
  { title: { en: 'Income Statement', ar: 'قائمة الدخل' }, desc: { en: 'P&L, gross margin, net income', ar: 'الأرباح والخسائر والهامش الصافي' }, icon: BarChart3, route: '/finance/pnl', color: 'bg-primary/10 text-primary' },
  { title: { en: 'Expense Management', ar: 'إدارة المصروفات' }, desc: { en: 'Direct & indirect costs, accruals', ar: 'التكاليف المباشرة وغير المباشرة' }, icon: Receipt, route: '/finance/expenses', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { title: { en: 'Client Invoices', ar: 'فواتير العملاء' }, desc: { en: 'AR, partial payments, aging', ar: 'الذمم المدينة، الدفع الجزئي' }, icon: FileText, route: '/finance/invoices', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { title: { en: 'General Ledger', ar: 'دفتر الأستاذ العام' }, desc: { en: 'Journal entries, trial balance', ar: 'القيود اليومية، ميزان المراجعة' }, icon: BookOpen, route: '/finance/ledger', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  { title: { en: 'Check Register', ar: 'سجل الشيكات' }, desc: { en: 'Issue, print and clear checks', ar: 'إصدار وطباعة وإقفال الشيكات' }, icon: CreditCard, route: '/finance/checks', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  { title: { en: 'Loans & Financing', ar: 'القروض والتمويل' }, desc: { en: 'Loans, repayments, interest', ar: 'القروض والأقساط والفوائد' }, icon: Landmark, route: '/finance/loans', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  { title: { en: 'Campaigns & Offers', ar: 'الحملات والعروض' }, desc: { en: 'Budget tracking, ROI, spend', ar: 'تتبع الميزانية والعائد على الاستثمار' }, icon: Megaphone, route: '/finance/campaigns', color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300' },
  { title: { en: 'Chart of Accounts', ar: 'دليل الحسابات' }, desc: { en: 'Manage your account structure', ar: 'إدارة هيكل الحسابات' }, icon: Calculator, route: '/finance/accounts', color: 'bg-muted text-foreground' },
  { title: { en: 'GL & Cost Centers', ar: 'إعداد الحسابات' }, desc: { en: 'GL mappings, cost & profit centers', ar: 'ربط الحسابات ومراكز التكلفة والربح' }, icon: GitBranch, route: '/finance/gl-config', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
];

export default function FinanceHub() {
  const { language } = useLanguage();
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';
  const { data: kpis, isLoading } = useFinanceKPIs();

  const fmt = (n: number) => `${n.toFixed(3)} ${currency}`;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">
            {ar ? 'المحاسبة والمالية' : 'Accounting & Finance'}
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {ar ? 'لوحة التحكم المالية' : 'Finance Hub'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ar ? 'نظام محاسبة متكامل بالقيد المزدوج' : 'Integrated double-entry accounting system'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/finance/ledger')} className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" />{ar ? 'قيد يومي' : 'New Journal Entry'}
          </Button>
          <Button size="sm" onClick={() => navigate('/finance/pnl')} className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />{ar ? 'قائمة الدخل' : 'P&L Statement'}
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label={ar ? 'الإيرادات (الشهر)' : 'Revenue (Month)'} value={fmt(kpis?.revenue??0)} trend={kpis?.revChange} icon={TrendingUp} color="text-emerald-500" loading={isLoading} onClick={() => navigate('/finance/pnl')} />
        <KPICard label={ar ? 'المصروفات (الشهر)' : 'Expenses (Month)'} value={fmt(kpis?.expenses??0)} sub={ar?'المعتمدة والمدفوعة':'Approved & paid'} icon={TrendingDown} color="text-amber-500" loading={isLoading} onClick={() => navigate('/finance/expenses')} />
        <KPICard label={ar ? 'صافي الربح' : 'Net Income'} value={fmt(kpis?.netIncome??0)} sub={`${kpis?.grossMargin??0}% ${ar?'هامش':'margin'}`} icon={DollarSign} color={(kpis?.netIncome??0)>=0 ? 'text-emerald-500' : 'text-red-500'} loading={isLoading} onClick={() => navigate('/finance/pnl')} />
        <KPICard label={ar ? 'مستحقات العملاء' : 'A/R Outstanding'} value={fmt(kpis?.arOpen??0)} sub={ar?'فواتير مفتوحة':'Open invoices'} icon={AlertCircle} color="text-rose-500" loading={isLoading} onClick={() => navigate('/finance/invoices')} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label={ar ? 'قروض قائمة' : 'Outstanding Loans'} value={fmt(kpis?.outstandingLoans??0)} sub={ar?'الرصيد الحالي':'Current balance'} icon={Landmark} color="text-violet-500" loading={isLoading} onClick={() => navigate('/finance/loans')} />
        <KPICard label={ar ? 'شيكات معلقة' : 'Pending Checks'} value={fmt(kpis?.pendingChecks??0)} sub={ar?'إجمالي الشيكات':'Total issued'} icon={CreditCard} color="text-sky-500" loading={isLoading} onClick={() => navigate('/finance/checks')} />
        <KPICard label={ar ? 'الهامش الإجمالي' : 'Gross Margin'} value={`${kpis?.grossMargin??0}%`} sub={ar?'هذا الشهر':'This month'} icon={PiggyBank} color="text-primary" loading={isLoading} onClick={() => navigate('/finance/pnl')} />
        <KPICard label={ar ? 'صافي الربح المعدل' : 'Net Income'} value={fmt(kpis?.netIncome??0)} sub={ar?'الإيرادات - المصروفات':'Revenue - Expenses'} icon={BarChart3} color="text-primary" loading={isLoading} />
      </div>

      {/* Module cards */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          {ar ? 'الوحدات المالية' : 'Finance Modules'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FINANCE_MODULES.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.route} onClick={() => navigate(m.route)}
                className="text-left bg-card border border-border/60 rounded-2xl p-5 flex flex-col gap-3 feature-card hover:border-primary/30 transition-all group">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', m.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                    {ar ? m.title.ar : m.title.en}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ar ? m.desc.ar : m.desc.en}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
