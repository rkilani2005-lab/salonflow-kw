import { useEffect, useState } from 'react';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calculator, Plus, RefreshCw, Search, Pencil, Trash2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ── ZAINA platform tenant_id placeholder ──────────────────────
// The super admin's own CoA lives under a special "platform" tenant_id.
// We use a reserved UUID that maps to ZAINA's own accounting entity.
// This can be replaced with the actual platform tenant_id from the DB.
const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
const ACCOUNT_SUBTYPES: Record<string, string[]> = {
  asset:     ['current_asset','fixed_asset','bank','cash','accounts_receivable'],
  liability: ['current_liability','long_term_liability','accounts_payable','accrued_liability','loan_payable'],
  equity:    ['owners_equity','retained_earnings'],
  revenue:   ['service_revenue','product_revenue','other_revenue'],
  expense:   ['cogs','operating_expense','payroll','rent','marketing','depreciation','interest_expense','other_expense'],
};

const TYPE_COLORS: Record<string, string> = {
  asset:     'bg-emerald-900/30 text-emerald-400 border-emerald-800',
  liability: 'bg-red-900/30 text-red-400 border-red-800',
  equity:    'bg-violet-900/30 text-violet-400 border-violet-800',
  revenue:   'bg-blue-900/30 text-blue-400 border-blue-800',
  expense:   'bg-amber-900/30 text-amber-400 border-amber-800',
};

interface Account {
  id: string;
  code: string;
  name: string;
  name_ar: string | null;
  account_type: typeof ACCOUNT_TYPES[number];
  account_subtype: string;
  is_system: boolean;
  is_active: boolean;
  description: string | null;
  opening_balance: number;
}

const EMPTY_FORM = {
  code: '', name: '', name_ar: '', account_type: 'asset' as const,
  account_subtype: 'current_asset', description: '', opening_balance: '0', is_system: false,
};

export default function AdminAccounts() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      // Fetch ZAINA's own platform-level chart of accounts
      // These are stored with a special platform tenant_id
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('tenant_id', PLATFORM_TENANT_ID)
        .order('code');

      if (error) {
        // If no platform CoA exists yet, return empty — admin can build from scratch
        if (error.code === 'PGRST116' || error.message.includes('no rows')) {
          setAccounts([]);
        } else {
          console.error(error);
        }
      } else {
        setAccounts((data || []) as Account[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditAccount(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (acc: Account) => {
    setEditAccount(acc);
    setForm({
      code: acc.code,
      name: acc.name,
      name_ar: acc.name_ar || '',
      account_type: acc.account_type as any,
      account_subtype: acc.account_subtype,
      description: acc.description || '',
      opening_balance: String(acc.opening_balance),
      is_system: acc.is_system,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        tenant_id: PLATFORM_TENANT_ID,
        code: form.code.trim(),
        name: form.name.trim(),
        name_ar: form.name_ar.trim() || null,
        account_type: form.account_type,
        account_subtype: form.account_subtype,
        description: form.description.trim() || null,
        opening_balance: parseFloat(form.opening_balance) || 0,
        is_system: form.is_system,
      };

      if (editAccount) {
        const { error } = await supabase
          .from('chart_of_accounts')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editAccount.id);
        if (error) throw error;
        toast({ title: 'Account updated' });
      } else {
        const { error } = await supabase
          .from('chart_of_accounts')
          .insert(payload);
        if (error) throw error;
        toast({ title: 'Account created' });
      }

      await fetchAccounts();
      setShowDialog(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (acc: Account) => {
    if (acc.is_system) {
      toast({ title: 'Cannot delete', description: 'System accounts cannot be deleted.', variant: 'destructive' });
      return;
    }
    if (!confirm(`Delete account ${acc.code} — ${acc.name}?`)) return;
    const { error } = await supabase.from('chart_of_accounts').delete().eq('id', acc.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Account deleted' });
    await fetchAccounts();
  };

  const filtered = accounts.filter(a => {
    const matchType   = filterType === 'all' || a.account_type === filterType;
    const matchSearch = !search || a.code.includes(search) ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.name_ar || '').includes(search);
    return matchType && matchSearch;
  });

  // Summary by type
  const typeSummary = ACCOUNT_TYPES.map(t => ({
    type: t,
    count: accounts.filter(a => a.account_type === t).length,
  }));

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-red-500/70 mb-1">
            Platform Accounting
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100" style={{ fontFamily: 'Syne, sans-serif' }}>
            ZAINA Chart of Accounts
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Platform-level accounting structure for ZAINA's own books
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAccounts}
            className="h-8 gap-1.5 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </Button>
          <Button size="sm" onClick={openAdd}
            className="h-8 gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white border-0">
            <Plus className="h-3.5 w-3.5" />Add Account
          </Button>
        </div>
      </div>

      {/* Type summary pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterType('all')}
          className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
            filterType === 'all'
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'
          )}>
          All ({accounts.length})
        </button>
        {typeSummary.map(({ type, count }) => (
          <button key={type} onClick={() => setFilterType(type)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize',
              filterType === type
                ? cn('border', TYPE_COLORS[type])
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'
            )}>
            {type} ({count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
        <Input
          placeholder="Search by code, name or Arabic..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 placeholder:text-zinc-600"
        />
      </div>

      {/* Accounts table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11 w-full bg-zinc-800" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calculator className="h-10 w-10 text-zinc-700 mb-4" />
              <p className="text-sm font-medium text-zinc-400">
                {accounts.length === 0 ? 'No accounts yet' : 'No accounts match your filter'}
              </p>
              {accounts.length === 0 && (
                <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                  Add your first account to start building ZAINA's chart of accounts for platform-level bookkeeping.
                </p>
              )}
              {accounts.length === 0 && (
                <Button size="sm" onClick={openAdd}
                  className="mt-4 h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-0 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />Add First Account
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-800/50">
                    <th className="text-left py-3 px-4 font-semibold text-zinc-400">Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-zinc-400">Account Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-zinc-400">Arabic</th>
                    <th className="text-center py-3 px-4 font-semibold text-zinc-400">Type</th>
                    <th className="text-right py-3 px-4 font-semibold text-zinc-400">Opening Balance</th>
                    <th className="text-center py-3 px-4 font-semibold text-zinc-400">Status</th>
                    <th className="text-center py-3 px-4 font-semibold text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={a.id} className={cn(
                      'border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors',
                      i % 2 === 0 && 'bg-zinc-800/10'
                    )}>
                      <td className="py-3 px-4 font-mono font-bold text-zinc-300">{a.code}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-zinc-200">{a.name}</p>
                        {a.description && (
                          <p className="text-[10px] text-zinc-600 mt-0.5 truncate max-w-[200px]">{a.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-500" dir="rtl">{a.name_ar || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-full font-semibold border', TYPE_COLORS[a.account_type])}>
                          {a.account_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-300">
                        {Number(a.opening_balance).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {a.is_system
                          ? <span className="text-[10px] text-zinc-600">🔒 System</span>
                          : <span className="text-[10px] text-emerald-500">● Active</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => openEdit(a)}
                            className="h-6 w-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          {!a.is_system && (
                            <button onClick={() => handleDelete(a)}
                              className="h-6 w-6 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 hover:bg-red-950/40 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-700 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editAccount ? `Edit Account — ${editAccount.code}` : 'New Account'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Account Code *</Label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. 1010" className="h-9 bg-zinc-800 border-zinc-700 text-zinc-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Account Type *</Label>
                <Select value={form.account_type} onValueChange={v => setForm({ ...form, account_type: v as any, account_subtype: ACCOUNT_SUBTYPES[v][0] })}>
                  <SelectTrigger className="h-9 text-xs bg-zinc-800 border-zinc-700 text-zinc-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize text-zinc-200">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Account Name (English) *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Cash - KWD" className="h-9 bg-zinc-800 border-zinc-700 text-zinc-100" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Account Name (Arabic)</Label>
              <Input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })}
                placeholder="مثال: النقد - دينار" dir="rtl"
                className="h-9 bg-zinc-800 border-zinc-700 text-zinc-100" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Sub-type</Label>
              <Select value={form.account_subtype} onValueChange={v => setForm({ ...form, account_subtype: v })}>
                <SelectTrigger className="h-9 text-xs bg-zinc-800 border-zinc-700 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {(ACCOUNT_SUBTYPES[form.account_type] || []).map(s => (
                    <SelectItem key={s} value={s} className="text-zinc-200">{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2} placeholder="Optional account description"
                className="text-sm resize-none bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Opening Balance</Label>
              <Input type="number" step="0.001" value={form.opening_balance}
                onChange={e => setForm({ ...form, opening_balance: e.target.value })}
                className="h-9 bg-zinc-800 border-zinc-700 text-zinc-100" />
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <Switch checked={form.is_system} onCheckedChange={v => setForm({ ...form, is_system: v })}
                className="data-[state=checked]:bg-red-600" />
              <div>
                <p className="text-xs font-medium text-zinc-300">System Account</p>
                <p className="text-[10px] text-zinc-600">System accounts cannot be deleted by users</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}
              className="border-zinc-700 text-zinc-400 hover:bg-zinc-800">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.code || !form.name}
              className="bg-red-600 hover:bg-red-700 text-white border-0">
              {saving ? 'Saving...' : editAccount ? 'Save Changes' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
