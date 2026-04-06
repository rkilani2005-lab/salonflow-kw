import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useServicePackages, useCreateServicePackage, useUpdateServicePackage,
  useClientPackages, useSellPackage, useRedeemPackageSession,
  type ServicePackage, type ClientPackage,
} from '@/hooks/usePackages';
import { useServicesManagement } from '@/hooks/useServices';
import { useClients } from '@/hooks/useClients';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Package, Plus, Edit2, Tag, Users, Loader2, CheckCircle2,
  RefreshCw, Scissors, Clock, Star, ChevronRight, RotateCcw,
} from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

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

export default function Packages() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const { data: packages = [], isLoading: pkgLoading } = useServicePackages();
  const { data: services  = [] } = useServicesManagement();
  const { data: clients   = [] } = useClients();
  const createPkg  = useCreateServicePackage();
  const updatePkg  = useUpdateServicePackage();
  const sellPkg    = useSellPackage();
  const redeemSess = useRedeemPackageSession();

  // Package dialog
  const [pkgOpen,    setPkgOpen]    = useState(false);
  const [editingPkg, setEditingPkg] = useState<ServicePackage | null>(null);
  const [pkgForm, setPkgForm] = useState({
    name:'', name_ar:'', description:'', service_id:'',
    sessions_total: 5, price:'', valid_days:'', is_active: true, color:'#C0395E',
  });

  // Sell dialog
  const [sellOpen,      setSellOpen]      = useState(false);
  const [sellPkgId,     setSellPkgId]     = useState('');
  const [sellClientId,  setSellClientId]  = useState('');
  const [sellNotes,     setSellNotes]     = useState('');
  const [selling,       setSelling]       = useState(false);

  // Lookup dialog (check a client's packages)
  const [lookupOpen,    setLookupOpen]    = useState(false);
  const [lookupClient,  setLookupClient]  = useState('');
  const { data: clientPkgs = [] } = useClientPackages(lookupOpen ? lookupClient : null);

  const openNewPkg = () => {
    setEditingPkg(null);
    setPkgForm({ name:'', name_ar:'', description:'', service_id:'', sessions_total:5, price:'', valid_days:'', is_active:true, color:'#C0395E' });
    setPkgOpen(true);
  };

  const openEditPkg = (p: ServicePackage) => {
    setEditingPkg(p);
    setPkgForm({
      name: p.name, name_ar: p.name_ar||'', description: p.description||'',
      service_id: p.service_id||'', sessions_total: p.sessions_total,
      price: String(p.price), valid_days: p.valid_days ? String(p.valid_days) : '',
      is_active: p.is_active, color: p.color||'#C0395E',
    });
    setPkgOpen(true);
  };

  const handleSavePkg = async () => {
    const payload = {
      name: pkgForm.name, name_ar: pkgForm.name_ar||null, description: pkgForm.description||null,
      service_id: pkgForm.service_id||null, sessions_total: pkgForm.sessions_total,
      price: Number(pkgForm.price), valid_days: pkgForm.valid_days ? Number(pkgForm.valid_days) : null,
      is_active: pkgForm.is_active, color: pkgForm.color,
    };
    if (editingPkg) await updatePkg.mutateAsync({ id: editingPkg.id, ...payload });
    else await createPkg.mutateAsync(payload as any);
    setPkgOpen(false);
  };

  const handleSell = async () => {
    if (!sellPkgId || !sellClientId) return;
    const pkg = packages.find(p => p.id === sellPkgId);
    if (!pkg) return;
    setSelling(true);
    await sellPkg.mutateAsync({
      package_id: sellPkgId, client_id: sellClientId,
      sessions_total: pkg.sessions_total, valid_days: pkg.valid_days, notes: sellNotes||undefined,
    });
    setSelling(false);
    setSellOpen(false);
    setSellPkgId(''); setSellClientId(''); setSellNotes('');
  };

  const handleRedeem = async (cp: ClientPackage) => {
    await redeemSess.mutateAsync({ client_package_id: cp.id, client_id: cp.client_id });
  };

  const activePackages  = packages.filter(p => p.is_active);
  const inactivePackages = packages.filter(p => !p.is_active);
  const totalSessions   = packages.reduce((s, p) => s + p.sessions_total, 0);

  const selectedPkg = packages.find(p => p.id === sellPkgId);
  const savingPkg = createPkg.isPending || updatePkg.isPending;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {ar ? 'الخدمات' : 'Services'}
          </p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily:'Syne,sans-serif', letterSpacing:'-0.04em' }}>
            {ar ? 'باقات الخدمات' : 'Service Packages'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ar ? 'باقات متعددة الجلسات بسعر مخفض' : 'Multi-session bundles sold at a discounted price'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setLookupOpen(true)}>
            <Users className="h-3.5 w-3.5"/>{ar ? 'رصيد العميلة' : 'Client Balance'}
          </Button>
          <Button size="sm" className="gap-1.5 h-9" onClick={() => setSellOpen(true)} disabled={activePackages.length === 0}>
            <Tag className="h-3.5 w-3.5"/>{ar ? 'بيع باقة' : 'Sell Package'}
          </Button>
          <Button size="sm" className="gap-1.5 h-9" onClick={openNewPkg}>
            <Plus className="h-3.5 w-3.5"/>{ar ? 'باقة جديدة' : 'New Package'}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: ar?'الباقات النشطة':'Active Packages', val: activePackages.length,  color:'text-primary',     icon: Package  },
          { label: ar?'إجمالي الجلسات':'Total Sessions',   val: totalSessions,           color:'text-blue-600',    icon: Scissors },
          { label: ar?'القيمة الإجمالية':'Total Value',    val: `${packages.reduce((s,p)=>s+Number(p.price),0).toFixed(3)} ${currency}`, color:'text-emerald-600', icon: Tag },
        ].map(({ label, val, color, icon: Icon }) => (
          <Card key={label} className="border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <Icon className={cn('h-4 w-4', color)}/>
              </div>
              <p className={cn('stat-number text-xl font-black', color)}>{val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Package list */}
      <Tabs defaultValue="active">
        <TabsList className="h-8 bg-muted/50">
          <TabsTrigger value="active"   className="text-xs">{ar?'نشطة':'Active'} ({activePackages.length})</TabsTrigger>
          <TabsTrigger value="inactive" className="text-xs">{ar?'غير نشطة':'Inactive'} ({inactivePackages.length})</TabsTrigger>
        </TabsList>

        {[{ value:'active', items: activePackages }, { value:'inactive', items: inactivePackages }].map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {pkgLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-24 rounded-md"/>)}</div>
            ) : tab.items.length === 0 ? (
              <div className="border border-dashed rounded-md p-12 text-center text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30"/>
                <p className="text-sm">{tab.value==='active' ? (ar?'لا توجد باقات نشطة':'No active packages') : (ar?'لا توجد باقات غير نشطة':'No inactive packages')}</p>
                {tab.value==='active' && <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={openNewPkg}><Plus className="h-3.5 w-3.5"/>Create Package</Button>}
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden divide-y divide-border">
                {tab.items.map(pkg => {
                  const svc = pkg.service;
                  const discountPct = svc ? Math.round((1 - pkg.price / (svc.price * pkg.sessions_total)) * 100) : 0;
                  return (
                    <div key={pkg.id} className="flex items-center gap-4 px-5 py-4 bg-card hover:bg-muted/20 transition-colors">
                      {/* Color strip + icon */}
                      <div className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: `${pkg.color}20` }}>
                        <Package className="h-5 w-5" style={{ color: pkg.color }}/>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-semibold">{pkg.name}</p>
                          {discountPct > 0 && (
                            <Badge className="text-[9px] h-4 px-1.5 rounded-sm font-bold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
                              -{discountPct}%
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {pkg.sessions_total} {ar?'جلسات':'sessions'}
                          {svc ? ` · ${svc.name}` : ''}
                          {pkg.valid_days ? ` · ${ar?'صالحة':'valid'} ${pkg.valid_days} ${ar?'يوم':'days'}` : ` · ${ar?'لا تاريخ انتهاء':'no expiry'}`}
                        </p>
                        {pkg.description && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{pkg.description}</p>}
                      </div>

                      {/* Price */}
                      <div className="text-right flex-shrink-0">
                        <p className="stat-number text-base font-black">{Number(pkg.price).toFixed(3)}</p>
                        <p className="text-[10px] text-muted-foreground">{currency}</p>
                        {svc && discountPct > 0 && (
                          <p className="text-[10px] text-muted-foreground line-through">{(svc.price * pkg.sessions_total).toFixed(3)}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        {pkg.is_active && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                            onClick={() => { setSellPkgId(pkg.id); setSellOpen(true); }}>
                            <Tag className="h-3 w-3"/>Sell
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground"
                          onClick={() => openEditPkg(pkg)}>
                          <Edit2 className="h-3.5 w-3.5"/>
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

      {/* ── Create / Edit Package dialog ── */}
      <Dialog open={pkgOpen} onOpenChange={setPkgOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary"/>
              {editingPkg ? (ar?'تعديل الباقة':'Edit Package') : (ar?'باقة جديدة':'New Package')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold">{ar?'اسم الباقة *':'Package Name *'}</Label>
                <Input value={pkgForm.name} onChange={e => setPkgForm({...pkgForm,name:e.target.value})} className="h-9" placeholder="e.g. Hair Color Bundle"/>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold">{ar?'الاسم بالعربي':'Arabic Name'}</Label>
                <Input value={pkgForm.name_ar} onChange={e => setPkgForm({...pkgForm,name_ar:e.target.value})} className="h-9" dir="rtl" placeholder="باقة صبغ الشعر"/>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar?'الخدمة المرتبطة':'Linked Service'}</Label>
              <Select value={pkgForm.service_id} onValueChange={v => setPkgForm({...pkgForm, service_id:v})}>
                <SelectTrigger className="h-9"><SelectValue placeholder={ar?'اختياري':'Optional — any service'}/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any Service</SelectItem>
                  {(services as any[]).map((s:any) => <SelectItem key={s.id} value={s.id}>{s.name} ({Number(s.price).toFixed(3)} {currency})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar?'عدد الجلسات *':'Sessions *'}</Label>
                <Input type="number" min="1" value={pkgForm.sessions_total}
                  onChange={e => setPkgForm({...pkgForm,sessions_total:Number(e.target.value)})} className="h-9"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar?'السعر *':'Price *'}</Label>
                <Input type="number" min="0" step="0.001" value={pkgForm.price}
                  onChange={e => setPkgForm({...pkgForm,price:e.target.value})} className="h-9" placeholder="0.000"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar?'صلاحية (أيام)':'Valid (days)'}</Label>
                <Input type="number" min="1" value={pkgForm.valid_days}
                  onChange={e => setPkgForm({...pkgForm,valid_days:e.target.value})} className="h-9" placeholder="∞"/>
              </div>
            </div>

            {/* Discount preview */}
            {pkgForm.service_id && pkgForm.price && pkgForm.sessions_total > 0 && (() => {
              const svc = (services as any[]).find((s:any) => s.id === pkgForm.service_id);
              if (!svc) return null;
              const fullPrice = svc.price * pkgForm.sessions_total;
              const discount = ((1 - Number(pkgForm.price) / fullPrice) * 100).toFixed(0);
              return (
                <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-400">
                  Full price: {fullPrice.toFixed(3)} {currency} → Package: {Number(pkgForm.price).toFixed(3)} {currency}
                  {Number(discount) > 0 ? ` · Client saves ${Number(discount)}%` : ''}
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar?'وصف':'Description'}</Label>
              <Textarea value={pkgForm.description} onChange={e => setPkgForm({...pkgForm,description:e.target.value})}
                rows={2} className="resize-none text-sm" placeholder={ar?'اختياري':'Optional'}/>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">{ar?'نشطة':'Active'}</Label>
              <Switch checked={pkgForm.is_active} onCheckedChange={v => setPkgForm({...pkgForm,is_active:v})}/>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPkgOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSavePkg} disabled={savingPkg||!pkgForm.name||!pkgForm.price} className="gap-1.5 min-w-[110px]">
              {savingPkg ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle2 className="h-3.5 w-3.5"/>}
              {editingPkg ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sell Package dialog ── */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary"/>{ar?'بيع باقة':'Sell Package'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar?'الباقة *':'Package *'}</Label>
              <Select value={sellPkgId} onValueChange={setSellPkgId}>
                <SelectTrigger className="h-9"><SelectValue placeholder={ar?'اختري الباقة':'Select package'}/></SelectTrigger>
                <SelectContent>
                  {activePackages.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.sessions_total} sessions · {Number(p.price).toFixed(3)} {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar?'العميلة *':'Client *'}</Label>
              <Select value={sellClientId} onValueChange={setSellClientId}>
                <SelectTrigger className="h-9"><SelectValue placeholder={ar?'اختري العميلة':'Select client'}/></SelectTrigger>
                <SelectContent>
                  {(clients as any[]).map((c:any) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedPkg && (
              <div className="p-3 rounded-md bg-muted/40 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Sessions</span><strong>{selectedPkg.sessions_total}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Price</span><strong className="stat-number">{Number(selectedPkg.price).toFixed(3)} {currency}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Validity</span><strong>{selectedPkg.valid_days ? `${selectedPkg.valid_days} days` : 'No expiry'}</strong></div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar?'ملاحظات':'Notes'}</Label>
              <Input value={sellNotes} onChange={e => setSellNotes(e.target.value)} className="h-9" placeholder={ar?'اختياري':'Optional'}/>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSellOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSell} disabled={selling||!sellPkgId||!sellClientId} className="gap-1.5 min-w-[110px]">
              {selling ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Tag className="h-3.5 w-3.5"/>}
              {ar?'بيع وتفعيل':'Sell & Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Client balance lookup dialog ── */}
      <Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary"/>{ar?'رصيد الباقات':'Client Package Balance'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar?'اختري العميلة':'Select Client'}</Label>
              <Select value={lookupClient} onValueChange={setLookupClient}>
                <SelectTrigger className="h-9"><SelectValue placeholder={ar?'اختري العميلة':'Select client'}/></SelectTrigger>
                <SelectContent>
                  {(clients as any[]).map((c:any) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {lookupClient && (
              <div className="space-y-2">
                {clientPkgs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{ar?'لا توجد باقات لهذه العميلة':'No packages for this client'}</p>
                ) : clientPkgs.map(cp => {
                  const expired = cp.expires_at && isPast(parseISO(cp.expires_at));
                  return (
                    <div key={cp.id} className={cn('border rounded-md p-3', cp.status==='depleted'||expired ? 'opacity-55' : '')}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold">{(cp.package as any)?.name || 'Package'}</p>
                        <StatusBadge status={expired ? 'expired' : cp.status}/>
                      </div>
                      {/* Progress bar */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.round(cp.sessions_used/cp.sessions_total*100)}%` }}/>
                        </div>
                        <span className="text-xs font-bold stat-number">{cp.sessions_remaining}/{cp.sessions_total}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">
                          {cp.expires_at ? `Expires ${format(parseISO(cp.expires_at),'MMM d, yyyy')}` : 'No expiry'}
                        </p>
                        {cp.status === 'active' && !expired && cp.sessions_remaining > 0 && (
                          <Button size="sm" className="h-6 text-[10px] px-2 gap-1"
                            onClick={() => handleRedeem(cp)}
                            disabled={redeemSess.isPending}>
                            <RotateCcw className="h-2.5 w-2.5"/>Redeem
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
            <Button variant="outline" size="sm" onClick={() => setLookupOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
