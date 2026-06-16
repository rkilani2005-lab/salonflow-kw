import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useServicePackages, useCreateServicePackage, useUpdateServicePackage,
  useClientPackages, useSellPackage, useRedeemPackageSession,
  useDueRenewals, useResolveRenewal,
  type ServicePackage, type ClientPackage, type PackageType, type PackageItem,
} from '@/hooks/usePackages';
import { useServicesManagement } from '@/hooks/useServices';
import { useClients } from '@/hooks/useClients';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Package, Plus, Edit2, Tag, Users, Loader2, CheckCircle2,
  Scissors, RotateCcw, Wallet, CalendarClock, Infinity as InfinityIcon,
  Layers, Trash2, BellRing,
} from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';

const NO_SERVICE = '__none__'; // sentinel — Radix Select forbids empty-string values

type TypeMeta = { label: string; labelAr: string; icon: any; blurb: string; blurbAr: string };
const TYPE_META: Record<PackageType, TypeMeta> = {
  session:    { label: 'Session Pack', labelAr: 'باقة جلسات', icon: Scissors,     blurb: 'N sessions of one service at a discount', blurbAr: 'عدة جلسات لخدمة واحدة بسعر مخفض' },
  bundle:     { label: 'Bundle',       labelAr: 'حزمة خدمات', icon: Layers,       blurb: 'Several different services, one price',   blurbAr: 'عدة خدمات مختلفة بسعر واحد' },
  wallet:     { label: 'Value Wallet', labelAr: 'محفظة رصيد', icon: Wallet,       blurb: 'Prepaid KWD credit, often with a bonus', blurbAr: 'رصيد مدفوع مقدماً مع مكافأة' },
  membership: { label: 'Membership',   labelAr: 'اشتراك',     icon: CalendarClock, blurb: 'Recurring allowance, renews each cycle', blurbAr: 'حصة متجددة كل دورة' },
  unlimited:  { label: 'Unlimited',    labelAr: 'غير محدود',  icon: InfinityIcon, blurb: 'Unlimited use until it expires',         blurbAr: 'استخدام غير محدود حتى الانتهاء' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active:   'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400',
    depleted: 'bg-muted text-muted-foreground border-border',
    expired:  'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    voided:   'bg-muted text-muted-foreground border-border',
  };
  return (
    <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-sm font-bold border capitalize', cfg[status] || cfg.active)}>
      {status}
    </Badge>
  );
}

const emptyForm = {
  name: '', name_ar: '', description: '', package_type: 'session' as PackageType,
  service_id: NO_SERVICE, sessions_total: 5, price: '', valid_days: '',
  is_active: true, color: '#C0395E',
  credit_value: '', credit_bonus: '',
  billing_interval: 'monthly' as 'weekly' | 'monthly' | 'yearly',
  sessions_per_cycle: '', auto_renew: false,
  items: [] as PackageItem[],
};

export default function Packages() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const { data: packages = [], isLoading: pkgLoading } = useServicePackages();
  const { data: services  = [] } = useServicesManagement();
  const { data: clients   = [] } = useClients();
  const { data: dueRenewals = [] } = useDueRenewals();
  const createPkg  = useCreateServicePackage();
  const updatePkg  = useUpdateServicePackage();
  const sellPkg    = useSellPackage();
  const redeem     = useRedeemPackageSession();
  const resolveRenewal = useResolveRenewal();

  const [pkgOpen, setPkgOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<ServicePackage | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [sellOpen, setSellOpen] = useState(false);
  const [sellPkgId, setSellPkgId] = useState('');
  const [sellClientId, setSellClientId] = useState('');
  const [sellNotes, setSellNotes] = useState('');

  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupClient, setLookupClient] = useState('');
  const { data: clientPkgs = [] } = useClientPackages(lookupOpen ? lookupClient : null);

  // wallet redeem amount entry, keyed by client_package id
  const [walletAmt, setWalletAmt] = useState<Record<string, string>>({});

  const svc = (id: string | null) => (services as any[]).find((s: any) => s.id === id);

  const openNewPkg = () => { setEditingPkg(null); setForm(emptyForm); setPkgOpen(true); };
  const openEditPkg = (p: ServicePackage) => {
    setEditingPkg(p);
    setForm({
      name: p.name, name_ar: p.name_ar || '', description: p.description || '',
      package_type: p.package_type, service_id: p.service_id || NO_SERVICE,
      sessions_total: p.sessions_total ?? 5, price: String(p.price),
      valid_days: p.valid_days ? String(p.valid_days) : '',
      is_active: p.is_active, color: p.color || '#C0395E',
      credit_value: p.credit_value != null ? String(p.credit_value) : '',
      credit_bonus: p.credit_bonus != null ? String(p.credit_bonus) : '',
      billing_interval: (p.billing_interval as any) || 'monthly',
      sessions_per_cycle: p.sessions_per_cycle != null ? String(p.sessions_per_cycle) : '',
      auto_renew: p.auto_renew,
      items: (p.items || []).map(it => ({ service_id: it.service_id, quantity: it.quantity })),
    });
    setPkgOpen(true);
  };

  const setType = (t: PackageType) => setForm(f => ({ ...f, package_type: t }));

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { service_id: null, quantity: 1 }] }));
  const updItem = (i: number, patch: Partial<PackageItem>) =>
    setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) }));
  const delItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    const t = form.package_type;
    const payload: any = {
      name: form.name, name_ar: form.name_ar || null, description: form.description || null,
      package_type: t,
      service_id: t === 'session' && form.service_id !== NO_SERVICE ? form.service_id : null,
      sessions_total: t === 'session' ? Number(form.sessions_total) : null,
      price: Number(form.price || 0),
      valid_days: form.valid_days ? Number(form.valid_days) : null,
      is_active: form.is_active, color: form.color,
      credit_value: t === 'wallet' ? Number(form.credit_value || 0) : null,
      credit_bonus: t === 'wallet' ? Number(form.credit_bonus || 0) : null,
      billing_interval: t === 'membership' ? form.billing_interval : null,
      sessions_per_cycle: t === 'membership' && form.sessions_per_cycle ? Number(form.sessions_per_cycle) : null,
      auto_renew: t === 'membership' ? form.auto_renew : false,
      is_unlimited: t === 'unlimited',
      items: t === 'bundle' ? form.items : undefined,
    };
    if (editingPkg) await updatePkg.mutateAsync({ id: editingPkg.id, ...payload });
    else await createPkg.mutateAsync(payload);
    setPkgOpen(false);
  };

  const handleSell = async () => {
    if (!sellPkgId || !sellClientId) return;
    await sellPkg.mutateAsync({ package_id: sellPkgId, client_id: sellClientId, notes: sellNotes || undefined });
    setSellOpen(false); setSellPkgId(''); setSellClientId(''); setSellNotes('');
  };

  const handleRedeem = async (cp: ClientPackage, serviceId?: string | null) => {
    if (cp.package_type === 'wallet') {
      const amt = Number(walletAmt[cp.id] || 0);
      if (amt <= 0) return;
      await redeem.mutateAsync({ client_package_id: cp.id, client_id: cp.client_id, amount: amt });
      setWalletAmt(s => ({ ...s, [cp.id]: '' }));
    } else {
      await redeem.mutateAsync({ client_package_id: cp.id, client_id: cp.client_id, service_id: serviceId ?? cp.package?.service_id ?? null });
    }
  };

  const activePackages = packages.filter(p => p.is_active);
  const inactivePackages = packages.filter(p => !p.is_active);
  const selectedSellPkg = packages.find(p => p.id === sellPkgId);
  const saving = createPkg.isPending || updatePkg.isPending;
  const t = form.package_type;

  // price preview for session packs
  const sessionDiscount = (() => {
    if (t !== 'session' || form.service_id === NO_SERVICE || !form.price) return null;
    const s = svc(form.service_id); if (!s) return null;
    const full = s.price * Number(form.sessions_total);
    if (full <= 0) return null;
    return { full, pct: Math.round((1 - Number(form.price) / full) * 100) };
  })();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {ar ? 'الخدمات' : 'Services'}
          </p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily: 'Bricolage Grotesque,sans-serif', letterSpacing: '-0.04em' }}>
            {ar ? 'الباقات والاشتراكات' : 'Packages & Memberships'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ar ? 'باقات جلسات، حزم، محافظ رصيد، اشتراكات وغير محدود' : 'Session packs, bundles, value wallets, memberships & unlimited'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setLookupOpen(true)}>
            <Users className="h-3.5 w-3.5" />{ar ? 'رصيد العميلة' : 'Client Balance'}
          </Button>
          <Button size="sm" className="gap-1.5 h-9" onClick={() => setSellOpen(true)} disabled={activePackages.length === 0}>
            <Tag className="h-3.5 w-3.5" />{ar ? 'بيع باقة' : 'Sell Package'}
          </Button>
          <Button size="sm" className="gap-1.5 h-9" onClick={openNewPkg}>
            <Plus className="h-3.5 w-3.5" />{ar ? 'باقة جديدة' : 'New Package'}
          </Button>
        </div>
      </div>

      {/* Due renewals banner */}
      {dueRenewals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-4 flex items-center gap-3">
            <BellRing className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
              {ar ? `${dueRenewals.length} اشتراك بحاجة لتحصيل التجديد` : `${dueRenewals.length} membership renewal(s) due for collection`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: ar ? 'الباقات النشطة' : 'Active Packages', val: activePackages.length, color: 'text-primary', icon: Package },
          { label: ar ? 'الأنواع' : 'Package Types', val: new Set(packages.map(p => p.package_type)).size, color: 'text-blue-600', icon: Layers },
          { label: ar ? 'تجديدات مستحقة' : 'Renewals Due', val: dueRenewals.length, color: 'text-amber-600', icon: CalendarClock },
        ].map(({ label, val, color, icon: Icon }) => (
          <Card key={label} className="border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <p className={cn('stat-number text-xl font-black', color)}>{val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Package list */}
      <Tabs defaultValue="active">
        <TabsList className="h-8 bg-muted/50">
          <TabsTrigger value="active" className="text-xs">{ar ? 'نشطة' : 'Active'} ({activePackages.length})</TabsTrigger>
          <TabsTrigger value="inactive" className="text-xs">{ar ? 'غير نشطة' : 'Inactive'} ({inactivePackages.length})</TabsTrigger>
        </TabsList>

        {[{ value: 'active', items: activePackages }, { value: 'inactive', items: inactivePackages }].map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {pkgLoading ? (
              <LoadingState variant="rows" rows={3} />
            ) : tab.items.length === 0 ? (
              <EmptyState
                icon={Package}
                size="compact"
                title={tab.value === 'active' ? (ar ? 'لا توجد باقات نشطة' : 'No active packages') : (ar ? 'لا توجد باقات غير نشطة' : 'No inactive packages')}
                action={tab.value === 'active' ? { label: ar ? 'إنشاء باقة' : 'Create Package', onClick: openNewPkg } : undefined}
              />
            ) : (
              <div className="border rounded-md overflow-hidden divide-y divide-border">
                {tab.items.map(pkg => {
                  const meta = TYPE_META[pkg.package_type];
                  const TypeIcon = meta.icon;
                  return (
                    <div key={pkg.id} className="flex items-center gap-4 px-5 py-4 bg-card hover:bg-muted/20 transition-colors">
                      <div className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${pkg.color}20` }}>
                        <TypeIcon className="h-5 w-5" style={{ color: pkg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-semibold">{pkg.name}</p>
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-sm font-bold capitalize">
                            {ar ? meta.labelAr : meta.label}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {pkg.package_type === 'session' && `${pkg.sessions_total} ${ar ? 'جلسات' : 'sessions'}${pkg.service ? ` · ${pkg.service.name}` : ''}`}
                          {pkg.package_type === 'bundle' && `${(pkg.items || []).length} ${ar ? 'خدمات' : 'services'}`}
                          {pkg.package_type === 'wallet' && `${formatCurrency(pkg.credit_value || 0)}${(pkg.credit_bonus || 0) > 0 ? ` + ${formatCurrency(pkg.credit_bonus || 0)} ${ar ? 'مكافأة' : 'bonus'}` : ''}`}
                          {pkg.package_type === 'membership' && `${pkg.sessions_per_cycle ?? '∞'} / ${pkg.billing_interval}${pkg.auto_renew ? ` · ${ar ? 'تجديد تلقائي' : 'auto-renew'}` : ''}`}
                          {pkg.package_type === 'unlimited' && (ar ? 'استخدام غير محدود' : 'unlimited use')}
                          {pkg.valid_days ? ` · ${ar ? 'صالحة' : 'valid'} ${pkg.valid_days} ${ar ? 'يوم' : 'd'}` : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="stat-number text-base font-black">{Number(pkg.price).toFixed(3)}</p>
                        <p className="text-[10px] text-muted-foreground">{currency}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {pkg.is_active && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setSellPkgId(pkg.id); setSellOpen(true); }}>
                            <Tag className="h-3 w-3" />{ar ? 'بيع' : 'Sell'}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground" onClick={() => openEditPkg(pkg)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Create / Edit dialog ── */}
      <Dialog open={pkgOpen} onOpenChange={setPkgOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {editingPkg ? (ar ? 'تعديل الباقة' : 'Edit Package') : (ar ? 'باقة جديدة' : 'New Package')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Type selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'نوع الباقة' : 'Package Type'}</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(TYPE_META) as PackageType[]).map(key => {
                  const m = TYPE_META[key]; const Icon = m.icon; const sel = t === key;
                  return (
                    <button key={key} type="button" onClick={() => setType(key)} disabled={!!editingPkg}
                      className={cn('flex flex-col items-center gap-1 p-2 rounded-md border text-[9px] font-semibold transition-colors',
                        sel ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40',
                        editingPkg && 'opacity-60 cursor-not-allowed')}>
                      <Icon className="h-4 w-4" />
                      {ar ? m.labelAr : m.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">{ar ? TYPE_META[t].blurbAr : TYPE_META[t].blurb}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold">{ar ? 'اسم الباقة *' : 'Package Name *'}</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9" placeholder="e.g. Glow Membership" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold">{ar ? 'الاسم بالعربي' : 'Arabic Name'}</Label>
                <Input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} className="h-9" dir="rtl" />
              </div>
            </div>

            {/* SESSION fields */}
            {t === 'session' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? 'الخدمة المرتبطة' : 'Linked Service'}</Label>
                  <Select value={form.service_id} onValueChange={v => setForm({ ...form, service_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SERVICE}>{ar ? 'أي خدمة' : 'Any service'}</SelectItem>
                      {(services as any[]).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({Number(s.price).toFixed(3)} {currency})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? 'الجلسات *' : 'Sessions *'}</Label>
                    <Input type="number" min="1" value={form.sessions_total} onChange={e => setForm({ ...form, sessions_total: Number(e.target.value) })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? 'السعر *' : 'Price *'}</Label>
                    <Input type="number" min="0" step="0.001" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="h-9" placeholder="0.000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? 'صلاحية' : 'Valid (d)'}</Label>
                    <Input type="number" min="1" value={form.valid_days} onChange={e => setForm({ ...form, valid_days: e.target.value })} className="h-9" placeholder="∞" />
                  </div>
                </div>
                {sessionDiscount && (
                  <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-400">
                    {ar ? 'القيمة الكاملة' : 'Full price'}: {sessionDiscount.full.toFixed(3)} {currency} → {Number(form.price).toFixed(3)} {currency}
                    {sessionDiscount.pct > 0 ? ` · ${ar ? 'توفير' : 'saves'} ${sessionDiscount.pct}%` : ''}
                  </div>
                )}
              </>
            )}

            {/* BUNDLE fields */}
            {t === 'bundle' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">{ar ? 'خدمات الحزمة' : 'Bundle Services'}</Label>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addItem}>
                    <Plus className="h-3 w-3" />{ar ? 'إضافة' : 'Add'}
                  </Button>
                </div>
                {form.items.length === 0 && <p className="text-[11px] text-muted-foreground">{ar ? 'أضف خدمتين أو أكثر' : 'Add two or more services'}</p>}
                {form.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={it.service_id || NO_SERVICE} onValueChange={v => updItem(i, { service_id: v === NO_SERVICE ? null : v })}>
                      <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder={ar ? 'اختر خدمة' : 'Select service'} /></SelectTrigger>
                      <SelectContent>
                        {(services as any[]).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({Number(s.price).toFixed(3)})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="1" value={it.quantity} onChange={e => updItem(i, { quantity: Number(e.target.value) })} className="h-8 w-16 text-xs" />
                    <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground/50" onClick={() => delItem(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? 'السعر *' : 'Bundle Price *'}</Label>
                    <Input type="number" min="0" step="0.001" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="h-9" placeholder="0.000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? 'صلاحية (أيام)' : 'Valid (days)'}</Label>
                    <Input type="number" min="1" value={form.valid_days} onChange={e => setForm({ ...form, valid_days: e.target.value })} className="h-9" placeholder="∞" />
                  </div>
                </div>
              </div>
            )}

            {/* WALLET fields */}
            {t === 'wallet' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? 'سعر البيع *' : 'Sale Price *'}</Label>
                  <Input type="number" min="0" step="0.001" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="h-9" placeholder="0.000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? 'الرصيد الممنوح *' : 'Credit Granted *'}</Label>
                  <Input type="number" min="0" step="0.001" value={form.credit_value} onChange={e => setForm({ ...form, credit_value: e.target.value })} className="h-9" placeholder="0.000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? 'مكافأة إضافية' : 'Bonus Credit'}</Label>
                  <Input type="number" min="0" step="0.001" value={form.credit_bonus} onChange={e => setForm({ ...form, credit_bonus: e.target.value })} className="h-9" placeholder="0.000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? 'صلاحية (أيام)' : 'Valid (days)'}</Label>
                  <Input type="number" min="1" value={form.valid_days} onChange={e => setForm({ ...form, valid_days: e.target.value })} className="h-9" placeholder="∞" />
                </div>
                {(Number(form.credit_value || 0) + Number(form.credit_bonus || 0)) > 0 && Number(form.price || 0) > 0 && (
                  <div className="col-span-2 p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-700 dark:text-emerald-400">
                    {ar ? 'العميلة تدفع' : 'Client pays'} {Number(form.price).toFixed(3)} → {ar ? 'تحصل على' : 'gets'} {(Number(form.credit_value || 0) + Number(form.credit_bonus || 0)).toFixed(3)} {currency} {ar ? 'رصيد' : 'credit'}
                  </div>
                )}
              </div>
            )}

            {/* MEMBERSHIP fields */}
            {t === 'membership' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? 'سعر الدورة *' : 'Price / cycle *'}</Label>
                    <Input type="number" min="0" step="0.001" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="h-9" placeholder="0.000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? 'دورة الفوترة' : 'Billing Cycle'}</Label>
                    <Select value={form.billing_interval} onValueChange={v => setForm({ ...form, billing_interval: v as any })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">{ar ? 'أسبوعي' : 'Weekly'}</SelectItem>
                        <SelectItem value="monthly">{ar ? 'شهري' : 'Monthly'}</SelectItem>
                        <SelectItem value="yearly">{ar ? 'سنوي' : 'Yearly'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs font-semibold">{ar ? 'جلسات لكل دورة (فارغ = غير محدود)' : 'Sessions / cycle (blank = unlimited)'}</Label>
                    <Input type="number" min="1" value={form.sessions_per_cycle} onChange={e => setForm({ ...form, sessions_per_cycle: e.target.value })} className="h-9" placeholder="∞" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/40">
                  <div>
                    <Label className="text-xs font-semibold">{ar ? 'تجديد تلقائي' : 'Auto-renew'}</Label>
                    <p className="text-[10px] text-muted-foreground">{ar ? 'يولّد فاتورة تجديد ويعيد الحصة كل دورة' : 'Raises a renewal invoice & resets allowance each cycle'}</p>
                  </div>
                  <Switch checked={form.auto_renew} onCheckedChange={v => setForm({ ...form, auto_renew: v })} />
                </div>
                <div className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-2">
                  {ar ? 'التحصيل يتم عند المكتب — لا يوجد خصم تلقائي من البطاقة بعد.' : 'Collection happens at the desk — no automatic card charge yet.'}
                </div>
              </>
            )}

            {/* UNLIMITED fields */}
            {t === 'unlimited' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? 'السعر *' : 'Price *'}</Label>
                  <Input type="number" min="0" step="0.001" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="h-9" placeholder="0.000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? 'صلاحية (أيام) *' : 'Valid (days) *'}</Label>
                  <Input type="number" min="1" value={form.valid_days} onChange={e => setForm({ ...form, valid_days: e.target.value })} className="h-9" placeholder="30" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-semibold">{ar ? 'الخدمة المرتبطة' : 'Linked Service'}</Label>
                  <Select value={form.service_id} onValueChange={v => setForm({ ...form, service_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SERVICE}>{ar ? 'أي خدمة' : 'Any service'}</SelectItem>
                      {(services as any[]).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'وصف' : 'Description'}</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="resize-none text-sm" placeholder={ar ? 'اختياري' : 'Optional'} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">{ar ? 'نشطة' : 'Active'}</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPkgOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.name || !form.price} className="gap-1.5 min-w-[110px]">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {editingPkg ? (ar ? 'تحديث' : 'Update') : (ar ? 'إنشاء' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sell dialog ── */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />{ar ? 'بيع باقة' : 'Sell Package'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'الباقة *' : 'Package *'}</Label>
              <Select value={sellPkgId} onValueChange={setSellPkgId}>
                <SelectTrigger className="h-9"><SelectValue placeholder={ar ? 'اختري الباقة' : 'Select package'} /></SelectTrigger>
                <SelectContent>
                  {activePackages.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} · {Number(p.price).toFixed(3)} {currency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'العميلة *' : 'Client *'}</Label>
              <Select value={sellClientId} onValueChange={setSellClientId}>
                <SelectTrigger className="h-9"><SelectValue placeholder={ar ? 'اختري العميلة' : 'Select client'} /></SelectTrigger>
                <SelectContent>
                  {(clients as any[]).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedSellPkg && (
              <div className="p-3 rounded-md bg-muted/40 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">{ar ? 'النوع' : 'Type'}</span><strong>{ar ? TYPE_META[selectedSellPkg.package_type].labelAr : TYPE_META[selectedSellPkg.package_type].label}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{ar ? 'السعر' : 'Price'}</span><strong className="stat-number">{Number(selectedSellPkg.price).toFixed(3)} {currency}</strong></div>
                {selectedSellPkg.package_type === 'wallet' && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{ar ? 'الرصيد' : 'Credit'}</span><strong>{((selectedSellPkg.credit_value || 0) + (selectedSellPkg.credit_bonus || 0)).toFixed(3)} {currency}</strong></div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'ملاحظات' : 'Notes'}</Label>
              <Input value={sellNotes} onChange={e => setSellNotes(e.target.value)} className="h-9" placeholder={ar ? 'اختياري' : 'Optional'} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSellOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
            <Button size="sm" onClick={handleSell} disabled={sellPkg.isPending || !sellPkgId || !sellClientId} className="gap-1.5 min-w-[110px]">
              {sellPkg.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
              {ar ? 'بيع وتفعيل' : 'Sell & Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Client balance lookup ── */}
      <Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />{ar ? 'رصيد الباقات' : 'Client Package Balance'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={lookupClient} onValueChange={setLookupClient}>
              <SelectTrigger className="h-9"><SelectValue placeholder={ar ? 'اختري العميلة' : 'Select client'} /></SelectTrigger>
              <SelectContent>
                {(clients as any[]).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>)}
              </SelectContent>
            </Select>

            {lookupClient && (
              <div className="space-y-2">
                {clientPkgs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{ar ? 'لا توجد باقات' : 'No packages for this client'}</p>
                ) : clientPkgs.map(cp => {
                  const expired = cp.expires_at && isPast(parseISO(cp.expires_at));
                  const meta = TYPE_META[cp.package_type];
                  const TypeIcon = meta.icon;
                  const canRedeem = cp.status === 'active' && !expired;
                  return (
                    <div key={cp.id} className={cn('border rounded-md p-3', (cp.status === 'depleted' || expired) ? 'opacity-60' : '')}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-semibold">{(cp.package as any)?.name || 'Package'}</p>
                        </div>
                        <StatusBadge status={expired ? 'expired' : cp.status} />
                      </div>

                      {/* SESSION / MEMBERSHIP — counter */}
                      {(cp.package_type === 'session' || cp.package_type === 'membership') && (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${cp.sessions_total ? Math.round((cp.sessions_used || 0) / cp.sessions_total * 100) : 0}%` }} />
                            </div>
                            <span className="text-xs font-bold stat-number">{cp.sessions_remaining ?? ((cp.sessions_total || 0) - (cp.sessions_used || 0))}/{cp.sessions_total}</span>
                          </div>
                          {cp.package_type === 'membership' && cp.renews_at && (
                            <p className="text-[10px] text-muted-foreground mb-1">{ar ? 'يتجدد' : 'Renews'} {format(parseISO(cp.renews_at), 'MMM d')}</p>
                          )}
                        </>
                      )}

                      {/* WALLET — balance + amount entry */}
                      {cp.package_type === 'wallet' && (
                        <div className="mb-2">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground">{ar ? 'الرصيد المتبقي' : 'Balance'}</span>
                            <strong className="stat-number">{(cp.credit_remaining || 0).toFixed(3)} / {(cp.credit_total || 0).toFixed(3)} {currency}</strong>
                          </div>
                          {canRedeem && (
                            <div className="flex items-center gap-2">
                              <Input type="number" min="0" step="0.001" placeholder="0.000"
                                value={walletAmt[cp.id] || ''} onChange={e => setWalletAmt(s => ({ ...s, [cp.id]: e.target.value }))}
                                className="h-7 text-xs flex-1" />
                              <Button size="sm" className="h-7 text-[10px] px-2 gap-1" disabled={redeem.isPending || !(Number(walletAmt[cp.id]) > 0)}
                                onClick={() => handleRedeem(cp)}>
                                <Wallet className="h-2.5 w-2.5" />{ar ? 'خصم' : 'Debit'}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* BUNDLE — per-service redeem */}
                      {cp.package_type === 'bundle' && (
                        <div className="space-y-1 mb-2">
                          {(cp.client_items || []).map(ci => {
                            const remaining = ci.quantity_total - ci.quantity_used;
                            return (
                              <div key={ci.id} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{ci.service?.name || 'Service'} · {remaining}/{ci.quantity_total}</span>
                                {canRedeem && remaining > 0 && (
                                  <Button size="sm" className="h-6 text-[10px] px-2 gap-1" disabled={redeem.isPending}
                                    onClick={() => handleRedeem(cp, ci.service_id)}>
                                    <RotateCcw className="h-2.5 w-2.5" />{ar ? 'استخدام' : 'Use'}
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* UNLIMITED — single redeem */}
                      {cp.package_type === 'unlimited' && (
                        <p className="text-xs text-muted-foreground mb-2">{ar ? 'استخدام غير محدود' : 'Unlimited use'}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">
                          {cp.expires_at ? `${ar ? 'ينتهي' : 'Expires'} ${format(parseISO(cp.expires_at), 'MMM d, yyyy')}` : (ar ? 'بلا انتهاء' : 'No expiry')}
                        </p>
                        {canRedeem && (cp.package_type === 'session' || cp.package_type === 'membership' || cp.package_type === 'unlimited')
                          && (cp.package_type === 'unlimited' || (cp.sessions_remaining ?? ((cp.sessions_total || 0) - (cp.sessions_used || 0))) > 0) && (
                          <Button size="sm" className="h-6 text-[10px] px-2 gap-1" disabled={redeem.isPending} onClick={() => handleRedeem(cp)}>
                            <RotateCcw className="h-2.5 w-2.5" />{ar ? 'استخدام جلسة' : 'Redeem'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLookupOpen(false)}>{ar ? 'إغلاق' : 'Close'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
