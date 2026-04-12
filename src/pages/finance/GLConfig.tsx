import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChartOfAccounts } from '@/hooks/useFinance';
import {
  useCostCenters, useUpsertCostCenter, useDeleteCostCenter,
  useProfitCenters, useUpsertProfitCenter, useDeleteProfitCenter,
  useGLMappings, useUpsertGLMapping,
} from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Settings2, Plus, Pencil, Trash2, Building2, Target,
  GitBranch, Save, CheckCircle2, AlertCircle, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Revenue mapping rows (service categories + products) ───────
const REVENUE_KEYS = [
  { key: 'hair',     label: 'Hair Services',    labelAr: 'خدمات الشعر' },
  { key: 'nails',    label: 'Nail Services',    labelAr: 'خدمات الأظافر' },
  { key: 'facial',   label: 'Facial / Skin',    labelAr: 'خدمات البشرة' },
  { key: 'spa',      label: 'Spa & Body',       labelAr: 'سبا وجسم' },
  { key: 'makeup',   label: 'Makeup',           labelAr: 'مكياج' },
  { key: 'other',    label: 'Other Services',   labelAr: 'خدمات أخرى' },
  { key: 'product',  label: 'Product Sales',    labelAr: 'مبيعات المنتجات' },
];

// ── Payment method mapping rows ────────────────────────────────
const PAYMENT_KEYS = [
  { key: 'cash',        label: 'Cash',        labelAr: 'نقد' },
  { key: 'knet',        label: 'KNET',        labelAr: 'كي-نت' },
  { key: 'credit_card', label: 'Credit Card', labelAr: 'بطاقة ائتمان' },
  { key: 'gift_card',   label: 'Gift Card',   labelAr: 'بطاقة هدية' },
  { key: 'loyalty',     label: 'Loyalty Points', labelAr: 'نقاط الولاء' },
];

// ── Expense category mapping rows ──────────────────────────────
const EXPENSE_KEYS = [
  { key: 'rent',           label: 'Rent',             labelAr: 'إيجار' },
  { key: 'salaries',       label: 'Salaries & Wages', labelAr: 'رواتب وأجور' },
  { key: 'utilities',      label: 'Utilities',        labelAr: 'مرافق' },
  { key: 'supplies',       label: 'Supplies / COGS',  labelAr: 'مستلزمات / تكلفة' },
  { key: 'marketing',      label: 'Marketing',        labelAr: 'تسويق' },
  { key: 'maintenance',    label: 'Maintenance',      labelAr: 'صيانة' },
  { key: 'insurance',      label: 'Insurance',        labelAr: 'تأمين' },
  { key: 'professional',   label: 'Professional Fees', labelAr: 'أتعاب مهنية' },
  { key: 'depreciation',   label: 'Depreciation',     labelAr: 'استهلاك' },
  { key: 'other',          label: 'Other Expenses',   labelAr: 'مصروفات أخرى' },
];

// ── Inline GL Mapping row ─────────────────────────────────────
function MappingRow({
  rowKey, label, labelAr, mappingType, existing, accounts, costCenters, profitCenters, ar,
}: {
  rowKey: string; label: string; labelAr: string; mappingType: string;
  existing: any; accounts: any[]; costCenters: any[]; profitCenters: any[];
  ar: boolean;
}) {
  const upsert = useUpsertGLMapping();
  const [debit,    setDebit]    = useState(existing?.debit_account_id  || '');
  const [credit,   setCredit]   = useState(existing?.credit_account_id || '');
  const [cc,       setCc]       = useState(existing?.cost_center_id    || '');
  const [pc,       setPc]       = useState(existing?.profit_center_id  || '');
  const [saved,    setSaved]    = useState(false);

  const isDirty =
    debit  !== (existing?.debit_account_id  || '') ||
    credit !== (existing?.credit_account_id || '') ||
    cc     !== (existing?.cost_center_id    || '') ||
    pc     !== (existing?.profit_center_id  || '');

  const handleSave = async () => {
    await upsert.mutateAsync({
      mapping_type: mappingType, source_key: rowKey, label,
      debit_account_id:  debit  || null,
      credit_account_id: credit || null,
      cost_center_id:    cc     || null,
      profit_center_id:  pc     || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const revenueAccounts  = accounts.filter(a => a.account_type === 'revenue');
  const expenseAccounts  = accounts.filter(a => a.account_type === 'expense');
  const assetAccounts    = accounts.filter(a => a.account_type === 'asset');
  const liabilityAccounts= accounts.filter(a => a.account_type === 'liability');

  const getOptions = (side: 'debit' | 'credit') => {
    if (mappingType === 'revenue_service' || mappingType === 'revenue_product') {
      return side === 'debit' ? assetAccounts : revenueAccounts;
    }
    if (mappingType === 'payment_method') {
      return side === 'debit' ? assetAccounts : assetAccounts;
    }
    // expense
    return side === 'debit' ? [...expenseAccounts] : [...assetAccounts, ...liabilityAccounts];
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-center py-2.5 border-b border-border/40 last:border-0">
      {/* Label */}
      <div className="col-span-2">
        <p className="text-sm font-medium">{ar ? labelAr : label}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{rowKey}</p>
      </div>

      {/* Debit GL */}
      <div className="col-span-3">
        <Select value={debit} onValueChange={setDebit}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={ar ? 'مدين (GL)' : 'Debit GL…'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{ar ? '— لا يوجد —' : '— None —'}</SelectItem>
            {getOptions('debit').map(a => (
              <SelectItem key={a.id} value={a.id}>
                <span className="font-mono text-[10px] text-muted-foreground mr-1">{a.code}</span>
                {ar && a.name_ar ? a.name_ar : a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Credit GL */}
      <div className="col-span-3">
        <Select value={credit} onValueChange={setCredit}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={ar ? 'دائن (GL)' : 'Credit GL…'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{ar ? '— لا يوجد —' : '— None —'}</SelectItem>
            {getOptions('credit').map(a => (
              <SelectItem key={a.id} value={a.id}>
                <span className="font-mono text-[10px] text-muted-foreground mr-1">{a.code}</span>
                {ar && a.name_ar ? a.name_ar : a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cost Center */}
      <div className="col-span-2">
        <Select value={cc} onValueChange={setCc}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={ar ? 'مركز التكلفة' : 'Cost Ctr'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{ar ? '— لا يوجد —' : '— None —'}</SelectItem>
            {costCenters.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Profit Center + Save */}
      <div className="col-span-2 flex items-center gap-1">
        <Select value={pc} onValueChange={setPc}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder={ar ? 'مركز الربح' : 'Profit Ctr'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{ar ? '— لا يوجد —' : '— None —'}</SelectItem>
            {profitCenters.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant={saved ? 'default' : isDirty ? 'secondary' : 'ghost'}
          className="h-8 w-8 flex-shrink-0"
          onClick={handleSave} disabled={upsert.isPending || !isDirty && !saved}>
          {saved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                 : <Save className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ── Center CRUD Dialog ─────────────────────────────────────────
function CenterDialog({
  open, onClose, initial, type, upsert, ar,
}: {
  open: boolean; onClose: () => void; initial: any; type: 'cost' | 'profit';
  upsert: any; ar: boolean;
}) {
  const [code, setCode]       = useState(initial?.code    || '');
  const [name, setName]       = useState(initial?.name    || '');
  const [nameAr, setNameAr]   = useState(initial?.name_ar || '');
  const [desc, setDesc]       = useState(initial?.description || '');
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) return;
    setSaving(true);
    try {
      await upsert.mutateAsync({ id: initial?.id, code: code.trim(), name: name.trim(), name_ar: nameAr || null, description: desc || null });
      onClose();
    } finally { setSaving(false); }
  };

  const title = type === 'cost'
    ? (initial ? (ar ? 'تعديل مركز التكلفة' : 'Edit Cost Center') : (ar ? 'مركز تكلفة جديد' : 'New Cost Center'))
    : (initial ? (ar ? 'تعديل مركز الربح' : 'Edit Profit Center') : (ar ? 'مركز ربح جديد' : 'New Profit Center'));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-sm">{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{ar ? 'الرمز *' : 'Code *'}</Label>
              <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CC-001" className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? 'الاسم (EN) *' : 'Name (EN) *'}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Operations" className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{ar ? 'الاسم بالعربي' : 'Name (AR)'}</Label>
            <Input value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="العمليات" className="h-8 text-sm" dir="rtl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{ar ? 'الوصف' : 'Description'}</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !code || !name}>
            {saving ? '…' : (ar ? 'حفظ' : 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Center Table ───────────────────────────────────────────────
function CenterTable({ type, ar }: { type: 'cost' | 'profit'; ar: boolean }) {
  const isCost = type === 'cost';
  const { data: centers = [], isLoading } = isCost ? useCostCenters() : useProfitCenters();
  const upsert = isCost ? useUpsertCostCenter() : useUpsertProfitCenter();
  const del    = isCost ? useDeleteCostCenter() : useDeleteProfitCenter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isCost
            ? (ar ? 'مراكز التكلفة تُستخدم لتتبع المصروفات بشكل مُفصَّل' : 'Cost centers track where costs occur')
            : (ar ? 'مراكز الربح تُستخدم لتتبع الإيرادات والأرباح' : 'Profit centers track revenue and profitability')}
        </p>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />{ar ? 'إضافة' : 'Add'}
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-24 w-full" /> : centers.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground text-sm">
          {ar ? 'لا توجد مراكز بعد' : 'No centers yet — add one above'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y divide-border">
          <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-2">{ar ? 'الرمز' : 'Code'}</div>
            <div className="col-span-4">{ar ? 'الاسم' : 'Name'}</div>
            <div className="col-span-4">{ar ? 'الوصف' : 'Description'}</div>
            <div className="col-span-2 text-right">{ar ? 'إجراء' : 'Action'}</div>
          </div>
          {centers.map(c => (
            <div key={c.id} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center hover:bg-muted/10">
              <div className="col-span-2"><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{c.code}</span></div>
              <div className="col-span-4">
                <p className="text-sm font-medium">{c.name}</p>
                {c.name_ar && <p className="text-xs text-muted-foreground" dir="rtl">{c.name_ar}</p>}
              </div>
              <div className="col-span-4 text-xs text-muted-foreground">{c.description || '—'}</div>
              <div className="col-span-2 flex gap-1 justify-end">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => { if (confirm('Delete?')) del.mutate(c.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CenterDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} type={type} upsert={upsert} ar={ar} />
    </div>
  );
}

// ── Main GL Config Page ────────────────────────────────────────
export default function GLConfig() {
  const { language } = useLanguage();
  const { tenant } = useAuth();
  const ar = language === 'ar';

  const { data: accounts = [], isLoading: accsLoading } = useChartOfAccounts();
  const { data: costCenters  = [] } = useCostCenters();
  const { data: profitCenters = [] } = useProfitCenters();
  const { data: mappings = [], isLoading: mapsLoading } = useGLMappings();

  const getMapping = (type: string, key: string) =>
    mappings.find(m => m.mapping_type === type && m.source_key === key);

  const hasAccounts = accounts.length > 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
          {ar ? 'الإعدادات المالية' : 'Finance Configuration'}
        </p>
        <h1 className="text-3xl font-black leading-none" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.04em' }}>
          {ar ? 'إعداد الحسابات والمراكز' : 'GL, Cost & Profit Centers'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {ar
            ? 'إعداد مراكز التكلفة والربح وربط العمليات بحسابات الأستاذ العام'
            : 'Configure cost & profit centers and map business operations to GL accounts'}
        </p>
      </div>

      {/* No accounts warning */}
      {!accsLoading && !hasAccounts && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{ar ? 'لا توجد حسابات في دليل الحسابات' : 'No accounts in Chart of Accounts'}</p>
            <p className="text-xs mt-0.5">
              {ar ? 'يرجى إضافة حسابات أولاً من صفحة دليل الحسابات قبل إعداد الربط.' : 'Add accounts in Chart of Accounts first before setting up GL mappings.'}
              {' '}<a href="/finance/accounts" className="underline font-medium">{ar ? 'الذهاب إلى دليل الحسابات ←' : 'Go to Chart of Accounts →'}</a>
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="cost-centers">
        <TabsList className="h-9">
          <TabsTrigger value="cost-centers" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />{ar ? 'مراكز التكلفة' : 'Cost Centers'}
          </TabsTrigger>
          <TabsTrigger value="profit-centers" className="gap-1.5 text-xs">
            <Target className="h-3.5 w-3.5" />{ar ? 'مراكز الربح' : 'Profit Centers'}
          </TabsTrigger>
          <TabsTrigger value="revenue-mapping" className="gap-1.5 text-xs">
            <GitBranch className="h-3.5 w-3.5" />{ar ? 'ربط الإيرادات' : 'Revenue Mapping'}
          </TabsTrigger>
          <TabsTrigger value="expense-mapping" className="gap-1.5 text-xs">
            <GitBranch className="h-3.5 w-3.5 rotate-180" />{ar ? 'ربط المصروفات' : 'Expense Mapping'}
          </TabsTrigger>
          <TabsTrigger value="payment-mapping" className="gap-1.5 text-xs">
            <Settings2 className="h-3.5 w-3.5" />{ar ? 'ربط طرق الدفع' : 'Payment Methods'}
          </TabsTrigger>
        </TabsList>

        {/* ── Cost Centers ─────────────────────────────── */}
        <TabsContent value="cost-centers" className="mt-4">
          <Card className="border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />{ar ? 'مراكز التكلفة' : 'Cost Centers'}
              </CardTitle>
              <CardDescription className="text-xs">
                {ar ? 'مراكز التكلفة تُستخدم لتصنيف وتتبع المصروفات حسب القسم أو النشاط'
                     : 'Group costs by department, activity, or location for detailed cost tracking'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <CenterTable type="cost" ar={ar} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Profit Centers ───────────────────────────── */}
        <TabsContent value="profit-centers" className="mt-4">
          <Card className="border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />{ar ? 'مراكز الربح' : 'Profit Centers'}
              </CardTitle>
              <CardDescription className="text-xs">
                {ar ? 'مراكز الربح تُستخدم لتتبع الإيرادات والأرباح حسب قسم أو فرع أو خط إنتاج'
                     : 'Track revenue and profitability per branch, division, or product line'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <CenterTable type="profit" ar={ar} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Revenue GL Mapping ───────────────────────── */}
        <TabsContent value="revenue-mapping" className="mt-4">
          <Card className="border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitBranch className="h-4 w-4" />{ar ? 'ربط الإيرادات بالحسابات' : 'Revenue → GL Mapping'}
              </CardTitle>
              <CardDescription className="text-xs">
                {ar ? 'حدد الحساب المدين (نقد/بنك) والحساب الدائن (إيرادات) لكل فئة خدمة'
                     : 'For each service category, set the Debit GL (cash/bank) and Credit GL (revenue account). Each save button applies immediately.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 pb-2 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div className="col-span-2">{ar ? 'الفئة' : 'Category'}</div>
                <div className="col-span-3">{ar ? 'حساب مدين' : 'Debit GL (Cash/Bank)'}</div>
                <div className="col-span-3">{ar ? 'حساب دائن' : 'Credit GL (Revenue)'}</div>
                <div className="col-span-2">{ar ? 'مركز التكلفة' : 'Cost Center'}</div>
                <div className="col-span-2">{ar ? 'مركز الربح' : 'Profit Center'}</div>
              </div>
              {mapsLoading ? <Skeleton className="h-40 w-full mt-2" /> : (
                REVENUE_KEYS.map(r => (
                  <MappingRow key={r.key} rowKey={r.key} label={r.label} labelAr={r.labelAr}
                    mappingType="revenue_service"
                    existing={getMapping('revenue_service', r.key)}
                    accounts={accounts} costCenters={costCenters} profitCenters={profitCenters} ar={ar} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Expense GL Mapping ───────────────────────── */}
        <TabsContent value="expense-mapping" className="mt-4">
          <Card className="border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitBranch className="h-4 w-4 rotate-180" />{ar ? 'ربط المصروفات بالحسابات' : 'Expense → GL Mapping'}
              </CardTitle>
              <CardDescription className="text-xs">
                {ar ? 'حدد الحساب المدين (مصروف) والحساب الدائن (نقد/دائنون) لكل فئة مصروف'
                     : 'For each expense category, set the Debit GL (expense) and Credit GL (cash/AP). Assigns cost & profit centers per category.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-12 gap-2 pb-2 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div className="col-span-2">{ar ? 'الفئة' : 'Category'}</div>
                <div className="col-span-3">{ar ? 'حساب مدين' : 'Debit GL (Expense)'}</div>
                <div className="col-span-3">{ar ? 'حساب دائن' : 'Credit GL (Cash/AP)'}</div>
                <div className="col-span-2">{ar ? 'مركز التكلفة' : 'Cost Center'}</div>
                <div className="col-span-2">{ar ? 'مركز الربح' : 'Profit Center'}</div>
              </div>
              {mapsLoading ? <Skeleton className="h-40 w-full mt-2" /> : (
                EXPENSE_KEYS.map(r => (
                  <MappingRow key={r.key} rowKey={r.key} label={r.label} labelAr={r.labelAr}
                    mappingType="expense"
                    existing={getMapping('expense', r.key)}
                    accounts={accounts} costCenters={costCenters} profitCenters={profitCenters} ar={ar} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payment Method GL Mapping ────────────────── */}
        <TabsContent value="payment-mapping" className="mt-4">
          <Card className="border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4" />{ar ? 'ربط طرق الدفع' : 'Payment Methods → GL'}
              </CardTitle>
              <CardDescription className="text-xs">
                {ar ? 'حدد الحساب المدين لكل طريقة دفع (نقد، كي-نت، بطاقة). يُستخدم عند الترحيل التلقائي من نقطة البيع.'
                     : 'Map each payment method to its bank/cash GL account. Used for auto-posting POS transactions to the ledger.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-12 gap-2 pb-2 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div className="col-span-2">{ar ? 'طريقة الدفع' : 'Payment Method'}</div>
                <div className="col-span-3">{ar ? 'حساب مدين (نقد/بنك)' : 'Debit GL (Cash/Bank)'}</div>
                <div className="col-span-3">{ar ? 'حساب دائن' : 'Credit GL'}</div>
                <div className="col-span-2">{ar ? 'مركز التكلفة' : 'Cost Center'}</div>
                <div className="col-span-2">{ar ? 'مركز الربح' : 'Profit Center'}</div>
              </div>
              {mapsLoading ? <Skeleton className="h-32 w-full mt-2" /> : (
                PAYMENT_KEYS.map(r => (
                  <MappingRow key={r.key} rowKey={r.key} label={r.label} labelAr={r.labelAr}
                    mappingType="payment_method"
                    existing={getMapping('payment_method', r.key)}
                    accounts={accounts} costCenters={costCenters} profitCenters={profitCenters} ar={ar} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Info box */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 text-blue-800 dark:text-blue-300 mt-4">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-xs">
              {ar
                ? 'عند اكتمال الإعداد، سيقوم النظام تلقائياً بترحيل كل عملية بيع من نقطة البيع إلى قيود اليومية باستخدام هذا الربط. وهذا هو ما يجعل تقرير الأرباح والخسائر يعمل بشكل صحيح.'
                : 'Once configured, every POS sale will auto-post a journal entry using these mappings. This is what drives accurate P&L, Trial Balance, and General Ledger reports.'}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
