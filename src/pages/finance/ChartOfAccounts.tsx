import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChartOfAccounts, useCreateAccount, type Account } from '@/hooks/useFinance';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Calculator, Plus, Search, Pencil, Trash2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCOUNT_TYPES = ['asset','liability','equity','revenue','expense'] as const;

const ACCOUNT_SUBTYPES: Record<string,string[]> = {
  asset:     ['current_asset','fixed_asset','bank','cash','accounts_receivable'],
  liability: ['current_liability','long_term_liability','accounts_payable','accrued_liability','loan_payable'],
  equity:    ['owners_equity','retained_earnings'],
  revenue:   ['service_revenue','product_revenue','other_revenue'],
  expense:   ['cogs','operating_expense','payroll','rent','marketing','depreciation','interest_expense','other_expense'],
};

const TYPE_COLORS: Record<string,string> = {
  asset:     'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  liability: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  equity:    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800',
  revenue:   'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  expense:   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
};

const EMPTY_FORM = {
  code: '', name: '', name_ar: '',
  account_type: 'asset' as typeof ACCOUNT_TYPES[number],
  account_subtype: 'current_asset',
  description: '', opening_balance: '0',
};

export default function ChartOfAccounts() {
  const { language } = useLanguage();
  const { tenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const { data: accounts, isLoading } = useChartOfAccounts();
  const createAccount = useCreateAccount();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (acc: Account) => {
    setEditId(acc.id);
    setForm({
      code: acc.code,
      name: acc.name,
      name_ar: acc.name_ar || '',
      account_type: acc.account_type,
      account_subtype: acc.account_subtype,
      description: acc.description || '',
      opening_balance: String(acc.opening_balance),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase
          .from('chart_of_accounts')
          .update({
            code: form.code.trim(),
            name: form.name.trim(),
            name_ar: form.name_ar.trim() || null,
            account_type: form.account_type,
            account_subtype: form.account_subtype,
            description: form.description.trim() || null,
            opening_balance: parseFloat(form.opening_balance) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editId);
        if (error) throw error;
        toast({ title: ar ? 'تم التحديث' : 'Account updated' });
      } else {
        await createAccount.mutateAsync({
          code: form.code.trim(),
          name: form.name.trim(),
          name_ar: form.name_ar.trim() || null,
          account_type: form.account_type,
          account_subtype: form.account_subtype,
          description: form.description.trim() || null,
          opening_balance: parseFloat(form.opening_balance) || 0,
          is_system: false,
          is_active: true,
        } as any);
      }
      queryClient.invalidateQueries({ queryKey: ['coa'] });
      setShowDialog(false);
    } catch (err: any) {
      toast({ title: ar ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (acc: Account) => {
    if (acc.is_system) {
      toast({ title: ar ? 'لا يمكن الحذف' : 'Cannot delete', description: ar ? 'الحسابات الأساسية محمية' : 'System accounts are protected.', variant: 'destructive' });
      return;
    }
    if (!confirm(ar ? `حذف الحساب ${acc.code} — ${acc.name}؟` : `Delete account ${acc.code} — ${acc.name}?`)) return;
    const { error } = await supabase.from('chart_of_accounts').delete().eq('id', acc.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: ar ? 'تم الحذف' : 'Account deleted' });
    queryClient.invalidateQueries({ queryKey: ['coa'] });
  };

  const handleSeedDefaults = async () => {
    if (!tenant?.id) return;
    if (!confirm(ar ? 'هل تريد إضافة 40 حساباً افتراضياً؟ لن تُحذف حسابات موجودة.' : 'Add 40 default accounts? Existing accounts will not be affected.')) return;
    setSeeding(true);
    try {
      await supabase.rpc('seed_chart_of_accounts', { p_tenant_id: tenant.id });
      queryClient.invalidateQueries({ queryKey: ['coa'] });
      toast({ title: ar ? 'تم إضافة الحسابات الافتراضية' : 'Default accounts seeded' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const filtered = (accounts || []).filter(a => {
    const matchType   = filterType === 'all' || a.account_type === filterType;
    const matchSearch = !search
      || a.code.includes(search)
      || a.name.toLowerCase().includes(search.toLowerCase())
      || (a.name_ar || '').includes(search);
    return matchType && matchSearch;
  });

  const typeCounts = ACCOUNT_TYPES.reduce((m, t) => {
    m[t] = (accounts || []).filter(a => a.account_type === t).length;
    return m;
  }, {} as Record<string,number>);

  const TYPE_LABELS: Record<string,{en:string;ar:string}> = {
    asset:     { en:'Assets',      ar:'الأصول' },
    liability: { en:'Liabilities', ar:'الالتزامات' },
    equity:    { en:'Equity',      ar:'حقوق الملكية' },
    revenue:   { en:'Revenue',     ar:'الإيرادات' },
    expense:   { en:'Expenses',    ar:'المصروفات' },
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" dir={ar ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">
            {ar ? 'المحاسبة' : 'Accounting'}
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            {ar ? 'دليل الحسابات' : 'Chart of Accounts'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ar ? 'أنشئي هيكل حسابات صالونك كما تشاءين' : 'Build your salon\'s account structure your way'}
          </p>
        </div>
        <div className="flex gap-2">
          {(accounts || []).length === 0 && (
            <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={seeding}
              className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5">
              <Sparkles className="h-3.5 w-3.5" />
              {seeding ? (ar ? 'جارٍ الإضافة...' : 'Seeding...') : (ar ? 'إضافة حسابات افتراضية' : 'Seed Defaults')}
            </Button>
          )}
          <Button size="sm" onClick={openAdd} className="h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />{ar ? 'إضافة حساب' : 'Add Account'}
          </Button>
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterType('all')}
          className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
            filterType === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card border-border text-muted-foreground hover:border-primary/40'
          )}>
          {ar ? 'الكل' : 'All'} ({(accounts||[]).length})
        </button>
        {ACCOUNT_TYPES.map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
              filterType === t
                ? cn('border', TYPE_COLORS[t])
                : 'bg-card border-border text-muted-foreground hover:border-primary/40'
            )}>
            {ar ? TYPE_LABELS[t].ar : TYPE_LABELS[t].en} ({typeCounts[t] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={ar ? 'ابحث بالكود أو الاسم...' : 'Search by code or name...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      {/* Table */}
      <Card className="border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calculator className="h-10 w-10 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">
                {(accounts || []).length === 0
                  ? (ar ? 'لا توجد حسابات بعد' : 'No accounts yet')
                  : (ar ? 'لا توجد نتائج' : 'No accounts match')}
              </p>
              {(accounts || []).length === 0 && (
                <>
                  <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                    {ar
                      ? 'ابدئي ببناء دليل حساباتك، أو أضيفي 40 حساباً افتراضياً دفعة واحدة.'
                      : 'Start building your chart of accounts, or seed 40 defaults at once.'}
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={seeding} className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5">
                      <Sparkles className="h-3 w-3" />{ar ? 'إضافة افتراضية' : 'Seed Defaults'}
                    </Button>
                    <Button size="sm" onClick={openAdd} className="h-7 text-xs gap-1">
                      <Plus className="h-3 w-3" />{ar ? 'أضيفي حساباً' : 'Add Account'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">{ar ? 'الكود' : 'Code'}</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">{ar ? 'اسم الحساب' : 'Account Name'}</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground hidden sm:table-cell">{ar ? 'الاسم بالعربي' : 'Arabic Name'}</th>
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">{ar ? 'النوع' : 'Type'}</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground hidden md:table-cell">{ar ? 'الرصيد الافتتاحي' : 'Opening Balance'}</th>
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">{ar ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={a.id} className={cn(
                      'border-b last:border-0 hover:bg-muted/20 transition-colors',
                      i % 2 === 0 && 'bg-muted/5'
                    )}>
                      <td className="py-3 px-4 font-mono font-bold text-primary">{a.code}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{a.name}</p>
                        {a.description && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">{a.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell" dir="rtl">
                        {a.name_ar || <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-full font-semibold border', TYPE_COLORS[a.account_type])}>
                          {ar ? TYPE_LABELS[a.account_type].ar : a.account_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono hidden md:table-cell">
                        {Number(a.opening_balance) !== 0
                          ? <span className="font-semibold">{Number(a.opening_balance).toFixed(3)} {currency}</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => openEdit(a)}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title={ar ? 'تعديل' : 'Edit'}>
                            <Pencil className="h-3 w-3" />
                          </button>
                          {!a.is_system && (
                            <button onClick={() => handleDelete(a)}
                              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title={ar ? 'حذف' : 'Delete'}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                          {a.is_system && (
                            <span className="text-[10px] text-muted-foreground/40 px-1">🔒</span>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId
                ? (ar ? 'تعديل الحساب' : 'Edit Account')
                : (ar ? 'إضافة حساب جديد' : 'New Account')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{ar ? 'كود الحساب *' : 'Account Code *'}</Label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. 1010" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{ar ? 'نوع الحساب *' : 'Account Type *'}</Label>
                <Select value={form.account_type}
                  onValueChange={v => setForm({ ...form, account_type: v as any, account_subtype: ACCOUNT_SUBTYPES[v][0] })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {ar ? TYPE_LABELS[t].ar : TYPE_LABELS[t].en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? 'الاسم بالإنجليزية *' : 'Name (English) *'}</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Cash - KWD" className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? 'الاسم بالعربية' : 'Name (Arabic)'}</Label>
              <Input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })}
                placeholder="مثال: النقد - دينار" dir="rtl" className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? 'الفئة الفرعية' : 'Sub-type'}</Label>
              <Select value={form.account_subtype} onValueChange={v => setForm({ ...form, account_subtype: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(ACCOUNT_SUBTYPES[form.account_type] || []).map(s => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? 'الرصيد الافتتاحي' : 'Opening Balance'} ({currency})</Label>
              <Input type="number" step="0.001" value={form.opening_balance}
                onChange={e => setForm({ ...form, opening_balance: e.target.value })} className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? 'وصف (اختياري)' : 'Description (optional)'}</Label>
              <Textarea value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2} className="text-sm resize-none"
                placeholder={ar ? 'وصف الحساب' : 'Account description'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.code || !form.name}>
              {saving
                ? (ar ? 'جارٍ الحفظ...' : 'Saving...')
                : editId ? (ar ? 'حفظ التعديلات' : 'Save Changes') : (ar ? 'إنشاء الحساب' : 'Create Account')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
