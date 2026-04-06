import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Building2, Users, TrendingUp, TrendingDown, DollarSign,
  Activity, Crown, Sparkles, Zap, AlertTriangle,
  CheckCircle2, Clock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const PLAN_COLORS = { starter: '#94a3b8', professional: '#C0395E', ai: '#f59e0b' };
const CHART_COLORS = ['#C0395E','#D4956A','#45A08C','#7C5CBF'];

interface TenantRow {
  id: string;
  name: string;
  subscription_plan: string | null;
  is_active: boolean | null;
  is_trial: boolean | null;
  trial_ends_at: string | null;
  created_at: string | null;
}

interface MonthBucket { month: string; new: number; churn: number; arr: number; }

function KPICard({ label, value, sub, icon: Icon, trend, color = 'text-primary', loading, onClick }: {
  label: string; value: string | number; sub?: string; icon: React.ComponentType<{className?:string}>;
  trend?: number; color?: string; loading: boolean; onClick?: () => void;
}) {
  return (
    <Card className={cn('border', onClick && 'cursor-pointer hover:border-primary/40 transition-colors')} onClick={onClick}>
      <CardContent className="p-5">
        {loading ? (<><Skeleton className="h-3 w-24 mb-3"/><Skeleton className="h-8 w-28 mb-2"/><Skeleton className="h-3 w-20"/></>) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
              <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                <Icon className={cn('h-3.5 w-3.5', color)}/>
              </div>
            </div>
            <p className="stat-number text-2xl font-black tracking-tight">{value}</p>
            {trend !== undefined ? (
              <div className={cn('flex items-center gap-1 mt-1.5 text-[11px] font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {trend >= 0 ? <ArrowUpRight className="h-3 w-3"/> : <ArrowDownRight className="h-3 w-3"/>}
                {Math.abs(trend).toFixed(1)}% vs last month
              </div>
            ) : sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Monthly plan revenue (rough MRR from plan counts)
const PLAN_MRR: Record<string, number> = { starter: 15, professional: 35, ai: 75 };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('tenants').select('id,name,subscription_plan,is_active,is_trial,trial_ends_at,created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTenants(data || []); setLoading(false); });
  }, []);

  // ── Derived metrics ───────────────────────────────────────────
  const active    = tenants.filter(t => t.is_active && !t.is_trial);
  const trial     = tenants.filter(t => t.is_trial);
  const suspended = tenants.filter(t => !t.is_active);

  const mrr = active.reduce((s, t) => s + (PLAN_MRR[t.subscription_plan || 'starter'] || 0), 0)
    + trial.length * 0; // trials are free
  const arr = mrr * 12;

  // Trials expiring within 7 days
  const expiringTrials = trial.filter(t =>
    t.trial_ends_at && differenceInDays(new Date(t.trial_ends_at), new Date()) <= 7
  );

  // Plan distribution
  const planDist = ['starter','professional','ai'].map(p => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    value: active.filter(t => (t.subscription_plan || 'starter') === p).length,
    color: PLAN_COLORS[p as keyof typeof PLAN_COLORS],
  }));

  // Monthly growth (last 6 months)
  const monthlyData: MonthBucket[] = useMemo(() => {
    const buckets: MonthBucket[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d).toISOString();
      const end   = endOfMonth(d).toISOString();
      const newCount = tenants.filter(t =>
        t.created_at && t.created_at >= start && t.created_at <= end
      ).length;
      const arrAtMonth = active.filter(t =>
        t.created_at && t.created_at <= end
      ).reduce((s, t) => s + (PLAN_MRR[t.subscription_plan || 'starter'] || 0), 0);
      buckets.push({ month: format(d, 'MMM'), new: newCount, churn: 0, arr: arrAtMonth });
    }
    return buckets;
  }, [tenants, active]);

  // Recent tenants (last 5)
  const recentTenants = tenants.slice(0, 5);

  // Health score per tenant (heuristic)
  const tenantHealth = active.slice(0, 8).map(t => {
    const daysSince = t.created_at ? differenceInDays(new Date(), new Date(t.created_at)) : 0;
    const score = Math.min(100, 40 + Math.min(daysSince, 30) * 2);
    return { ...t, score };
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black" style={{ fontFamily: 'Syne,sans-serif', letterSpacing: '-0.03em' }}>
          Platform Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">SaaS business metrics · ZAINA Salon Management</p>
      </div>

      {/* ── Core SaaS KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="MRR" value={`${mrr.toFixed(0)} KWD`} icon={DollarSign} color="text-emerald-600"
          sub={`${active.length} paying tenants`} loading={loading} onClick={() => navigate('/zaina-admin/subscriptions')}/>
        <KPICard label="ARR" value={`${arr.toFixed(0)} KWD`} icon={TrendingUp} color="text-primary"
          sub="Annualised run rate" loading={loading}/>
        <KPICard label="Active Tenants" value={active.length} icon={Building2} color="text-blue-600"
          sub={`${suspended.length} suspended`} loading={loading} onClick={() => navigate('/zaina-admin/tenants')}/>
        <KPICard label="Trial Tenants" value={trial.length} icon={Clock}
          color={expiringTrials.length > 0 ? 'text-amber-600' : 'text-muted-foreground'}
          sub={expiringTrials.length > 0 ? `${expiringTrials.length} expiring in 7d` : 'No expiries soon'}
          loading={loading}/>
      </div>

      {/* ── Expiring trials alert ── */}
      {!loading && expiringTrials.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {expiringTrials.length} trial{expiringTrials.length !== 1 ? 's' : ''} expiring within 7 days
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-0.5">
              {expiringTrials.map(t => t.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly growth */}
        <Card className="border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">New Tenants · Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full"/> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }}/>
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false}/>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                  <Bar dataKey="new" name="New Tenants" fill="#C0395E" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Plan distribution */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Plan Distribution</CardTitle>
            <CardDescription className="text-xs">{active.length} paying tenants</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full"/> : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={planDist} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                      {planDist.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {planDist.map(p => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }}/>
                        <span>{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{p.value}</span>
                        <span className="text-muted-foreground">
                          {active.length > 0 ? Math.round(p.value / active.length * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tenant health + recent ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenant health scores */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tenant Health</CardTitle>
            <CardDescription className="text-xs">Based on account age and plan tier</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full"/> : (
              <div className="space-y-2.5">
                {tenantHealth.map(t => (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-xs font-medium w-28 truncate">{t.name}</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full',
                        t.score >= 80 ? 'bg-emerald-500' : t.score >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                        style={{ width: `${t.score}%` }}/>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold w-8 text-right">{t.score}</span>
                      <Badge variant="outline" className={cn('text-[9px] h-4 px-1 rounded-sm capitalize',
                        (t.subscription_plan || 'starter') === 'ai' ? 'text-amber-600 border-amber-200' :
                        (t.subscription_plan || 'starter') === 'professional' ? 'text-primary border-primary/30' : 'border-border text-muted-foreground'
                      )}>
                        {(t.subscription_plan || 'starter').slice(0,3)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {tenantHealth.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No active tenants</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent tenants */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recent Signups</CardTitle>
            <CardDescription className="text-xs">Latest tenant registrations</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full"/> : (
              <div className="space-y-2">
                {recentTenants.map(t => {
                  const plan = t.subscription_plan || 'starter';
                  const PlanIcon = plan === 'ai' ? Zap : plan === 'professional' ? Crown : Sparkles;
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors">
                      <div className="h-8 w-8 rounded-sm bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary flex-shrink-0">
                        {t.name.slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {t.created_at ? format(new Date(t.created_at), 'MMM d, yyyy') : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {t.is_trial && <Badge className="text-[9px] h-4 px-1.5 rounded-sm bg-amber-100 text-amber-700 border-0">Trial</Badge>}
                        {!t.is_active && <Badge className="text-[9px] h-4 px-1.5 rounded-sm bg-red-100 text-red-700 border-0">Suspended</Badge>}
                        <PlanIcon className={cn('h-3.5 w-3.5',
                          plan === 'ai' ? 'text-amber-500' : plan === 'professional' ? 'text-primary' : 'text-muted-foreground'
                        )}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Manage Tenants', icon: Building2, path: '/zaina-admin/tenants' },
          { label: 'Subscriptions',  icon: Crown,      path: '/zaina-admin/subscriptions' },
          { label: 'Platform Revenue',icon: DollarSign, path: '/zaina-admin/finance' },
          { label: 'Analytics',      icon: Activity,   path: '/zaina-admin/analytics' },
        ].map(({ label, icon: Icon, path }) => (
          <button key={label} onClick={() => navigate(path)}
            className="flex flex-col items-center gap-2 p-4 rounded-md border bg-card hover:bg-muted/40 hover:border-primary/30 transition-all text-sm font-medium">
            <Icon className="h-5 w-5 text-primary"/>
            <span className="text-xs text-center">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
