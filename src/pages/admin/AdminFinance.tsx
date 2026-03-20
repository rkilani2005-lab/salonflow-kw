import { useEffect, useState } from 'react';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Building2,
  CreditCard, BarChart3, Receipt, Landmark, ArrowUpRight,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface PlatformFinance {
  totalGrossRevenue: number;
  totalTransactions: number;
  totalExpenses: number;
  totalOutstandingLoans: number;
  totalPendingChecks: number;
  activeTenantsWithRevenue: number;
  monthlyRevenue: { month: string; revenue: number; expenses: number }[];
  revenueByPlan: { plan: string; revenue: number; tenants: number }[];
  topTenants: { name: string; revenue: number; transactions: number }[];
  expensesByCategory: { category: string; amount: number }[];
  subscriptionRevenue: number;
}

const PIE_COLORS = ['#C0395E', '#D4956A', '#10b981', '#6366f1', '#f59e0b'];

export default function AdminFinance() {
  const [data, setData] = useState<PlatformFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6m');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;
        const monthList = Array.from({ length: months }, (_, i) =>
          subMonths(new Date(), months - 1 - i)
        );

        // ── Platform-wide transactions (all tenants) ──
        const { data: txns } = await supabase
          .from('transactions')
          .select('grand_total, created_at, tenant_id, status')
          .eq('status', 'completed');

        // ── Expenses across all tenants ──
        const { data: expenses } = await supabase
          .from('expense_entries')
          .select('total_amount, category, expense_date, tenant_id')
          .in('status', ['approved', 'paid']);

        // ── Loans ──
        const { data: loans } = await supabase
          .from('loans')
          .select('outstanding_balance')
          .eq('status', 'active');

        // ── Checks pending ──
        const { data: checks } = await supabase
          .from('checks')
          .select('amount')
          .in('status', ['draft', 'printed', 'issued']);

        // ── Tenants with plan data ──
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, name, subscription_plan, is_active');

        // ── Monthly revenue vs expenses ──
        const monthlyRevenue = monthList.map(m => {
          const mStr = format(m, 'yyyy-MM');
          const rev = (txns || [])
            .filter(t => t.created_at.startsWith(mStr))
            .reduce((s, t) => s + Number(t.grand_total), 0);
          const exp = (expenses || [])
            .filter(e => e.expense_date.startsWith(mStr))
            .reduce((s, e) => s + Number(e.total_amount), 0);
          return { month: format(m, 'MMM yy'), revenue: Math.round(rev * 1000) / 1000, expenses: Math.round(exp * 1000) / 1000 };
        });

        // ── Revenue by subscription plan ──
        const planMap: Record<string, { revenue: number; tenants: Set<string> }> = {};
        (txns || []).forEach(t => {
          const tenant = (tenants || []).find(tn => tn.id === t.tenant_id);
          const plan = tenant?.subscription_plan || 'unknown';
          if (!planMap[plan]) planMap[plan] = { revenue: 0, tenants: new Set() };
          planMap[plan].revenue += Number(t.grand_total);
          planMap[plan].tenants.add(t.tenant_id);
        });
        const revenueByPlan = Object.entries(planMap).map(([plan, d]) => ({
          plan: plan.charAt(0).toUpperCase() + plan.slice(1),
          revenue: Math.round(d.revenue * 1000) / 1000,
          tenants: d.tenants.size,
        })).sort((a, b) => b.revenue - a.revenue);

        // ── Top tenants by revenue ──
        const tenantRevMap: Record<string, { name: string; revenue: number; txns: number }> = {};
        (txns || []).forEach(t => {
          if (!tenantRevMap[t.tenant_id]) {
            const tn = (tenants || []).find(x => x.id === t.tenant_id);
            tenantRevMap[t.tenant_id] = { name: tn?.name || 'Unknown', revenue: 0, txns: 0 };
          }
          tenantRevMap[t.tenant_id].revenue += Number(t.grand_total);
          tenantRevMap[t.tenant_id].txns += 1;
        });
        const topTenants = Object.values(tenantRevMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10)
          .map(t => ({ name: t.name, revenue: Math.round(t.revenue * 1000) / 1000, transactions: t.txns }));

        // ── Expenses by category ──
        const catMap: Record<string, number> = {};
        (expenses || []).forEach(e => {
          catMap[e.category] = (catMap[e.category] || 0) + Number(e.total_amount);
        });
        const expensesByCategory = Object.entries(catMap)
          .map(([category, amount]) => ({ category, amount: Math.round(amount * 1000) / 1000 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8);

        // ── Subscription revenue estimate (plan × tenants) ──
        const PLAN_PRICES: Record<string, number> = { starter: 15, professional: 35, ai: 75 };
        const subRevenue = (tenants || []).filter(t => t.is_active)
          .reduce((s, t) => s + (PLAN_PRICES[t.subscription_plan || 'starter'] || 0), 0);

        setData({
          totalGrossRevenue: Math.round((txns || []).reduce((s, t) => s + Number(t.grand_total), 0) * 1000) / 1000,
          totalTransactions: (txns || []).length,
          totalExpenses: Math.round((expenses || []).reduce((s, e) => s + Number(e.total_amount), 0) * 1000) / 1000,
          totalOutstandingLoans: Math.round((loans || []).reduce((s, l) => s + Number(l.outstanding_balance), 0) * 1000) / 1000,
          totalPendingChecks: Math.round((checks || []).reduce((s, c) => s + Number(c.amount), 0) * 1000) / 1000,
          activeTenantsWithRevenue: Object.keys(tenantRevMap).length,
          monthlyRevenue,
          revenueByPlan,
          topTenants,
          expensesByCategory,
          subscriptionRevenue: subRevenue,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [period]);

  const KPI = ({ label, value, sub, icon: Icon, color = 'text-zinc-400' }: any) => (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-5">
        {loading ? <><Skeleton className="h-3 w-24 mb-3 bg-zinc-800" /><Skeleton className="h-8 w-28 bg-zinc-800" /></> : (
          <>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
              <div className="h-7 w-7 rounded-md bg-zinc-800 flex items-center justify-center">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
            </div>
            <p className="stat-number text-2xl font-bold text-zinc-100">{value}</p>
            {sub && <p className="text-[11px] text-zinc-600 mt-1.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );

  const tooltipStyle = { backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 11, color: '#e4e4e7' };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-red-500/70 mb-1">Platform Finance</p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100" style={{ fontFamily: 'Syne, sans-serif' }}>
            Finance & Accounts
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Platform-wide financial overview across all tenants</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="3m">Last 3 months</SelectItem>
            <SelectItem value="6m">Last 6 months</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Gross Revenue (All Tenants)" value={`${data?.totalGrossRevenue?.toFixed(3) || '—'} KWD`} sub={`${data?.totalTransactions || 0} transactions`} icon={TrendingUp} color="text-emerald-400" />
        <KPI label="Subscription Revenue (Est.)" value={`${data?.subscriptionRevenue?.toFixed(0) || '—'} KWD/mo`} sub={`${data?.activeTenantsWithRevenue || 0} revenue-generating tenants`} icon={CreditCard} color="text-primary" />
        <KPI label="Platform Expenses" value={`${data?.totalExpenses?.toFixed(3) || '—'} KWD`} sub="Approved & paid" icon={Receipt} color="text-amber-400" />
        <KPI label="Outstanding Loans" value={`${data?.totalOutstandingLoans?.toFixed(3) || '—'} KWD`} sub="Active loans balance" icon={Landmark} color="text-violet-400" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Net Platform Income" value={`${((data?.totalGrossRevenue || 0) - (data?.totalExpenses || 0)).toFixed(3)} KWD`} sub="Gross revenue − expenses" icon={DollarSign} color="text-emerald-400" />
        <KPI label="Pending Checks" value={`${data?.totalPendingChecks?.toFixed(3) || '—'} KWD`} sub="Draft / issued checks" icon={CreditCard} color="text-sky-400" />
        <KPI label="Gross Margin" value={data?.totalGrossRevenue && data.totalGrossRevenue > 0 ? `${Math.round(((data.totalGrossRevenue - data.totalExpenses) / data.totalGrossRevenue) * 1000) / 10}%` : '—'} sub="Revenue − expenses / revenue" icon={BarChart3} color="text-primary" />
        <KPI label="Active Tenants w/ Revenue" value={data?.activeTenantsWithRevenue || 0} sub="Generated at least 1 sale" icon={Building2} color="text-emerald-400" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Monthly Revenue vs Expenses */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-200">Revenue vs Expenses (Monthly)</CardTitle>
            <CardDescription className="text-xs text-zinc-600">Platform-wide, all tenants</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-56 w-full bg-zinc-800" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.monthlyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Plan */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-200">Revenue by Subscription Plan</CardTitle>
            <CardDescription className="text-xs text-zinc-600">Total transaction volume per plan tier</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-56 w-full bg-zinc-800" /> : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={data?.revenueByPlan || []} dataKey="revenue" nameKey="plan" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                      {(data?.revenueByPlan || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(3)} KWD`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {(data?.revenueByPlan || []).map((row, i) => (
                    <div key={row.plan} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-zinc-400">{row.plan}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-zinc-200">{row.revenue.toFixed(3)}</p>
                        <p className="text-zinc-600">{row.tenants} tenants</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Tenants by Revenue */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-200">Top 10 Tenants by Revenue</CardTitle>
            <CardDescription className="text-xs text-zinc-600">Total POS sales processed</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full bg-zinc-800" /> : (
              <div className="space-y-1.5">
                {(data?.topTenants || []).map((t, i) => {
                  const maxRev = data!.topTenants[0]?.revenue || 1;
                  return (
                    <div key={t.name} className="flex items-center gap-3">
                      <span className="text-[10px] text-zinc-600 w-4 flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-xs font-medium text-zinc-300 truncate max-w-[160px]">{t.name}</p>
                          <p className="text-xs font-bold text-zinc-100 ml-2">{t.revenue.toFixed(3)} KWD</p>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(t.revenue / maxRev) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-600 flex-shrink-0">{t.transactions} txns</span>
                    </div>
                  );
                })}
                {(!data?.topTenants?.length) && (
                  <p className="text-center py-8 text-xs text-zinc-600">No revenue data yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-200">Expenses by Category</CardTitle>
            <CardDescription className="text-xs text-zinc-600">All tenants, approved & paid</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full bg-zinc-800" /> : (data?.expensesByCategory?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.expensesByCategory} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#71717a' }} />
                  <YAxis dataKey="category" type="category" tick={{ fontSize: 10, fill: '#a1a1aa' }} width={110} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(3)} KWD`} />
                  <Bar dataKey="amount" name="Amount" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-xs text-zinc-600">No expense data yet</p>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Subscription Revenue Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-200">Subscription Revenue Breakdown by Plan</CardTitle>
          <CardDescription className="text-xs text-zinc-600">Estimated monthly recurring revenue per plan tier</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32 w-full bg-zinc-800" /> : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-800/50">
                    <th className="text-left py-3 px-4 font-semibold text-zinc-400">Plan</th>
                    <th className="text-right py-3 px-4 font-semibold text-zinc-400">Price/mo (KWD)</th>
                    <th className="text-right py-3 px-4 font-semibold text-zinc-400">Tenants</th>
                    <th className="text-right py-3 px-4 font-semibold text-zinc-400">MRR (KWD)</th>
                    <th className="text-right py-3 px-4 font-semibold text-zinc-400">Transaction Vol.</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.revenueByPlan || []).map((row, i) => {
                    const prices: Record<string, number> = { Starter: 15, Professional: 35, 'Ai': 75 };
                    const mrr = (prices[row.plan] || 0) * row.tenants;
                    return (
                      <tr key={row.plan} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="font-medium text-zinc-300">{row.plan}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-400">{prices[row.plan] || '?'}</td>
                        <td className="py-3 px-4 text-right text-zinc-300">{row.tenants}</td>
                        <td className="py-3 px-4 text-right font-bold text-zinc-100">{mrr.toFixed(3)}</td>
                        <td className="py-3 px-4 text-right text-emerald-400">{row.revenue.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-zinc-700 bg-zinc-800/40">
                    <td className="py-3 px-4 font-bold text-zinc-200" colSpan={3}>TOTAL</td>
                    <td className="py-3 px-4 text-right font-bold text-zinc-100">
                      {(data?.revenueByPlan || []).reduce((s, r) => {
                        const prices: Record<string, number> = { Starter: 15, Professional: 35, Ai: 75 };
                        return s + (prices[r.plan] || 0) * r.tenants;
                      }, 0).toFixed(3)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      {data?.totalGrossRevenue?.toFixed(3) || '—'} KWD
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
