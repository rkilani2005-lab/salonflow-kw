import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Calculator, Building2, Search, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TenantCOA {
  tenant_id: string;
  tenant_name: string;
  subscription_plan: string;
  account_count: number;
  has_coa: boolean;
  journal_entries: number;
  last_entry_date: string | null;
}

interface AccountSummary {
  account_type: string;
  count: number;
  total_balance: number;
}

const TYPE_COLORS: Record<string, string> = {
  asset:     'bg-emerald-900/30 text-emerald-400 border-emerald-800',
  liability: 'bg-red-900/30 text-red-400 border-red-800',
  equity:    'bg-violet-900/30 text-violet-400 border-violet-800',
  revenue:   'bg-blue-900/30 text-blue-400 border-blue-800',
  expense:   'bg-amber-900/30 text-amber-400 border-amber-800',
};

export default function AdminAccounts() {
  const [tenants, setTenants] = useState<TenantCOA[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [tenantAccounts, setTenantAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tenantList } = await supabase
        .from('tenants')
        .select('id, name, subscription_plan, is_active')
        .eq('is_active', true)
        .order('name');

      const results: TenantCOA[] = await Promise.all(
        (tenantList || []).map(async t => {
          const [coa, jes] = await Promise.all([
            supabase.from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
            supabase.from('journal_entries').select('id, entry_date', { count: 'exact' })
              .eq('tenant_id', t.id).order('entry_date', { ascending: false }).limit(1),
          ]);
          return {
            tenant_id: t.id,
            tenant_name: t.name,
            subscription_plan: t.subscription_plan || 'starter',
            account_count: coa.count || 0,
            has_coa: (coa.count || 0) > 0,
            journal_entries: jes.count || 0,
            last_entry_date: jes.data?.[0]?.entry_date || null,
          };
        })
      );
      setTenants(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const seedCoA = async (tenantId: string) => {
    setSeeding(tenantId);
    try {
      await supabase.rpc('seed_chart_of_accounts', { p_tenant_id: tenantId });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSeeding(null);
    }
  };

  const loadTenantAccounts = async (tenantId: string) => {
    setSelected(tenantId);
    setLoadingAccounts(true);
    try {
      const { data } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('code');
      setTenantAccounts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const filtered = tenants.filter(t =>
    t.tenant_name.toLowerCase().includes(search.toLowerCase())
  );

  const withCOA    = tenants.filter(t => t.has_coa).length;
  const withoutCOA = tenants.filter(t => !t.has_coa).length;
  const totalJEs   = tenants.reduce((s, t) => s + t.journal_entries, 0);

  const filteredAccounts = filterType === 'all'
    ? tenantAccounts
    : tenantAccounts.filter(a => a.account_type === filterType);

  const selectedTenant = tenants.find(t => t.tenant_id === selected);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-red-500/70 mb-1">Platform Finance</p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100" style={{ fontFamily: 'Syne, sans-serif' }}>
            Chart of Accounts
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Manage accounting setup across all tenants</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}
          className="h-8 gap-1.5 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </Button>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tenants with CoA',     val: withCOA,    icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Missing CoA',           val: withoutCOA, icon: AlertCircle,  color: 'text-amber-400' },
          { label: 'Total Journal Entries', val: totalJEs,   icon: BookOpen,     color: 'text-blue-400' },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label} className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="stat-number text-xl font-bold text-zinc-100">{val}</p>
                <p className="text-[11px] text-zinc-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Tenant list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <Input
              placeholder="Search tenants..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {loading ? [...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-zinc-800" />
            )) : filtered.map(t => (
              <button
                key={t.tenant_id}
                onClick={() => loadTenantAccounts(t.tenant_id)}
                className={cn(
                  'w-full text-left p-3.5 rounded-xl border transition-all duration-150',
                  selected === t.tenant_id
                    ? 'bg-red-950/30 border-red-800/50 text-zinc-100'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold truncate max-w-[160px]">{t.tenant_name}</p>
                  {t.has_coa
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                    : <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  }
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <Badge variant="outline" className={cn('text-[9px] h-3.5 px-1 rounded-full', {
                    'border-amber-800 text-amber-500': t.subscription_plan === 'ai',
                    'border-primary/40 text-primary/80': t.subscription_plan === 'professional',
                    'border-zinc-700 text-zinc-500': t.subscription_plan === 'starter',
                  })}>
                    {t.subscription_plan}
                  </Badge>
                  <span>{t.account_count} accounts</span>
                  <span>·</span>
                  <span>{t.journal_entries} JEs</span>
                </div>
                {!t.has_coa && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={e => { e.stopPropagation(); seedCoA(t.tenant_id); }}
                    disabled={seeding === t.tenant_id}
                    className="mt-2 h-6 text-[10px] bg-amber-950/30 border-amber-800/50 text-amber-400 hover:bg-amber-900/40 w-full"
                  >
                    {seeding === t.tenant_id ? 'Seeding...' : '⚡ Seed Chart of Accounts'}
                  </Button>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Accounts viewer */}
        <div className="lg:col-span-3">
          {!selected ? (
            <Card className="bg-zinc-900 border-zinc-800 h-full">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <Calculator className="h-10 w-10 text-zinc-700 mb-4" />
                <p className="text-sm font-medium text-zinc-400">Select a tenant</p>
                <p className="text-xs text-zinc-600 mt-1">Click a tenant to view their chart of accounts</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm text-zinc-200">{selectedTenant?.tenant_name}</CardTitle>
                    <CardDescription className="text-xs text-zinc-600">
                      {tenantAccounts.length} accounts · {selectedTenant?.journal_entries} journal entries
                    </CardDescription>
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-28 h-7 text-[10px] bg-zinc-800 border-zinc-700 text-zinc-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="asset">Assets</SelectItem>
                      <SelectItem value="liability">Liabilities</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expenses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[540px] overflow-y-auto">
                {loadingAccounts ? (
                  <div className="p-4 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full bg-zinc-800" />)}</div>
                ) : filteredAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
                    <BookOpen className="h-6 w-6 mb-2" />
                    <p className="text-xs">No accounts found</p>
                    {!selectedTenant?.has_coa && (
                      <Button size="sm" onClick={() => seedCoA(selected!)} disabled={seeding === selected}
                        className="mt-3 h-7 text-xs bg-amber-950/40 border-amber-800/50 text-amber-400 hover:bg-amber-900/50" variant="outline">
                        {seeding === selected ? 'Seeding...' : '⚡ Seed Default Chart of Accounts'}
                      </Button>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-800/50 sticky top-0">
                        <th className="text-left py-2.5 px-4 font-semibold text-zinc-400">Code</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-zinc-400">Account Name</th>
                        <th className="text-center py-2.5 px-4 font-semibold text-zinc-400">Type</th>
                        <th className="text-center py-2.5 px-4 font-semibold text-zinc-400">System</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((a, i) => (
                        <tr key={a.id} className={cn('border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30', i % 2 === 0 && 'bg-zinc-800/10')}>
                          <td className="py-2.5 px-4 font-mono font-bold text-zinc-400">{a.code}</td>
                          <td className="py-2.5 px-4 text-zinc-300 font-medium">
                            {a.name}
                            {a.name_ar && <span className="text-zinc-600 ml-2 text-[10px]" dir="rtl">{a.name_ar}</span>}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-full font-semibold border', TYPE_COLORS[a.account_type] || '')}>
                              {a.account_type}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {a.is_system
                              ? <span className="text-[10px] text-zinc-600">🔒 System</span>
                              : <span className="text-[10px] text-zinc-700">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
