import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useLoyaltyConfig, useSaveLoyaltyConfig,
  useGiftCards, useCreateGiftCard,
  usePromoCodes, useCreatePromoCode, useUpdatePromoCode,
  type PromoCode, type GiftCard,
} from '@/hooks/useLoyalty';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Star, Gift, Tag, Plus, Edit2, Loader2, Copy, Check,
  ToggleLeft, ToggleRight, AlertTriangle, Percent, Banknote,
  Clock, Users, ShieldCheck,
} from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

// ── random code generator ─────────────────────────────────────
const genCode = (prefix = '') =>
  prefix + Math.random().toString(36).substring(2, 8).toUpperCase();

export default function GiftCardsAndPromos() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">Marketing</p>
        <h1 className="text-3xl font-black leading-none" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.04em' }}>
          {ar ? 'الولاء والهدايا والعروض' : 'Loyalty, Gift Cards & Promos'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {ar ? 'نقاط الولاء، بطاقات الهدايا، وأكواد الخصم' : 'Reward loyal clients, sell gift cards, create discount codes'}
        </p>
      </div>

      <Tabs defaultValue="loyalty">
        <TabsList className="h-9 bg-muted/50">
          <TabsTrigger value="loyalty" className="gap-1.5 text-xs"><Star className="h-3.5 w-3.5"/>{ar ? 'الولاء' : 'Loyalty'}</TabsTrigger>
          <TabsTrigger value="giftcards" className="gap-1.5 text-xs"><Gift className="h-3.5 w-3.5"/>{ar ? 'بطاقات الهدايا' : 'Gift Cards'}</TabsTrigger>
          <TabsTrigger value="promos" className="gap-1.5 text-xs"><Tag className="h-3.5 w-3.5"/>{ar ? 'أكواد الخصم' : 'Promo Codes'}</TabsTrigger>
        </TabsList>

        <TabsContent value="loyalty" className="mt-4"><LoyaltyTab currency={currency} ar={ar}/></TabsContent>
        <TabsContent value="giftcards" className="mt-4"><GiftCardsTab currency={currency} ar={ar}/></TabsContent>
        <TabsContent value="promos" className="mt-4"><PromoCodesTab currency={currency} ar={ar}/></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Loyalty Tab ───────────────────────────────────────────────
function LoyaltyTab({ currency, ar }: { currency: string; ar: boolean }) {
  const { data: cfg, isLoading } = useLoyaltyConfig();
  const save = useSaveLoyaltyConfig();

  const [enabled,         setEnabled]         = useState<boolean | null>(null);
  const [pointsPerKwd,    setPointsPerKwd]    = useState('');
  const [kwdPerPoint,     setKwdPerPoint]     = useState('');  // local UI name; persisted as redemption_rate
  const [minRedeem,       setMinRedeem]       = useState('');
  const [maxRedeemPct,    setMaxRedeemPct]    = useState('');  // currently UI-only — not persisted (no column)
  const [initialized,     setInitialized]     = useState(false);

  if (cfg && !initialized) {
    setEnabled(cfg.is_active);
    setPointsPerKwd(String(cfg.points_per_kwd ?? 1));
    setKwdPerPoint(String(cfg.redemption_rate ?? 0.01));
    setMinRedeem(String(cfg.min_redemption ?? 100));
    // MAX_REDEEM_PCT is a code-side constant until schema migration adds it.
    setMaxRedeemPct('50');
    setInitialized(true);
  }
  if (!cfg && !initialized && !isLoading) {
    setEnabled(true); setPointsPerKwd('1'); setKwdPerPoint('0.01');
    setMinRedeem('100'); setMaxRedeemPct('50'); setInitialized(true);
  }

  const isEnabledVal = enabled ?? cfg?.is_active ?? true;
  const exampleEarn  = Math.round(20 * Number(pointsPerKwd || 1));
  const exampleRedeem = (100 * Number(kwdPerPoint || 0.01)).toFixed(3);

  const handleSave = () => save.mutate({
    is_active:       isEnabledVal,
    points_per_kwd:  Number(pointsPerKwd),
    redemption_rate: Number(kwdPerPoint),
    min_redemption:  Number(minRedeem),
    // max_redeem_pct intentionally omitted — no column.  Pending migration.
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-md"/>;

  return (
    <div className="space-y-4 max-w-xl">
      {/* Enable toggle */}
      <Card className="border">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{ar ? 'برنامج الولاء' : 'Loyalty Programme'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar ? 'العميلات يكسبن نقاطاً عند كل زيارة' : 'Clients earn points on every visit'}
            </p>
          </div>
          <Switch checked={isEnabledVal} onCheckedChange={setEnabled}/>
        </CardContent>
      </Card>

      {isEnabledVal && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'نقاط لكل KWD' : 'Points per KWD spent'}</Label>
              <Input type="number" min="0.1" step="0.1" value={pointsPerKwd}
                onChange={e => setPointsPerKwd(e.target.value)} className="h-10"/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'KWD لكل 100 نقطة' : `${currency} per point`}</Label>
              <Input type="number" min="0.001" step="0.001" value={kwdPerPoint}
                onChange={e => setKwdPerPoint(e.target.value)} className="h-10"/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'حد أدنى للصرف (نقطة)' : 'Min points to redeem'}</Label>
              <Input type="number" min="1" value={minRedeem}
                onChange={e => setMinRedeem(e.target.value)} className="h-10"/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'حد أقصى للصرف (% من الفاتورة)' : 'Max redeem (% of bill)'}</Label>
              <Input type="number" min="1" max="100" value={maxRedeemPct}
                onChange={e => setMaxRedeemPct(e.target.value)} className="h-10"/>
            </div>
          </div>

          {/* Live example */}
          <div className="p-4 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-1.5">
            <p className="font-semibold text-xs uppercase tracking-wider text-primary/70">Preview</p>
            <p>On a <strong>20.000 {currency}</strong> service → client earns <strong>{exampleEarn} points</strong></p>
            <p><strong>100 points</strong> = <strong>{exampleRedeem} {currency}</strong> off the bill</p>
            <p>Minimum to redeem: <strong>{minRedeem} points</strong> · Max: <strong>{maxRedeemPct}%</strong> of bill</p>
          </div>
        </>
      )}

      <Button onClick={handleSave} disabled={save.isPending} className="gap-1.5">
        {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <ShieldCheck className="h-3.5 w-3.5"/>}
        {ar ? 'حفظ الإعدادات' : 'Save Settings'}
      </Button>
    </div>
  );
}

// ── Gift Cards Tab ────────────────────────────────────────────
function GiftCardsTab({ currency, ar }: { currency: string; ar: boolean }) {
  const { data: cards = [], isLoading } = useGiftCards();
  const create = useCreateGiftCard();
  const [open, setOpen]       = useState(false);
  const [code, setCode]       = useState('');
  const [amount, setAmount]   = useState('');
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [expiry, setExpiry]   = useState('');
  const [copied, setCopied]   = useState<string | null>(null);

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    setCopied(c); setTimeout(() => setCopied(null), 1500);
  };

  const openNew = () => {
    setCode(genCode('GC-')); setAmount(''); setName(''); setPhone(''); setExpiry('');
    setOpen(true);
  };

  const handleCreate = async () => {
    if (!code || !amount) return;
    await create.mutateAsync({ code, amount: Number(amount), issued_to_name: name||undefined, issued_to_phone: phone||undefined, expires_at: expiry||null });
    setOpen(false);
  };

  const active   = cards.filter(c => c.status === 'active');
  const depleted = cards.filter(c => c.status !== 'active');

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{active.length} {ar ? 'بطاقات نشطة' : 'active gift cards'}</p>
          <p className="text-xs text-muted-foreground">{cards.reduce((s,c)=>s+Number(c.current_balance),0).toFixed(3)} {currency} total balance outstanding</p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5 h-9">
          <Plus className="h-3.5 w-3.5"/>{ar ? 'بطاقة جديدة' : 'New Gift Card'}
        </Button>
      </div>

      {isLoading ? <LoadingState variant="rows" rows={4} /> : cards.length === 0 ? (
        <EmptyState
          icon={Gift}
          size="compact"
          title={ar ? 'لا توجد بطاقات هدايا' : 'No gift cards yet'}
          description={ar ? 'أنشئي أول بطاقة هدية لإضافة رصيد يمكن استخدامه في البيع' : 'Create your first gift card to offer prepaid balance redeemable at POS.'}
          action={{ label: ar ? 'بطاقة جديدة' : 'New Gift Card', onClick: openNew }}
        />
      ) : (
        <div className="border rounded-md overflow-hidden divide-y divide-border">
          {cards.map(card => {
            const pctUsed = card.initial_balance > 0
              ? Math.round(((card.initial_balance - card.current_balance) / card.initial_balance) * 100) : 0;
            const isExpired = card.expires_at && isPast(parseISO(card.expires_at));
            return (
              <div key={card.id} className={cn('flex items-center gap-4 px-5 py-4 bg-card', card.status !== 'active' && 'opacity-50')}>
                <div className="h-10 w-10 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Gift className="h-5 w-5 text-amber-600"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold font-mono">{card.code}</p>
                    <button onClick={() => copyCode(card.code)}
                      className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                      {copied === card.code ? <Check className="h-3 w-3 text-emerald-500"/> : <Copy className="h-3 w-3"/>}
                    </button>
                    <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-sm font-bold',
                      card.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground border-border')}>
                      {isExpired ? 'Expired' : card.status}
                    </Badge>
                  </div>
                  {card.recipient_name && <p className="text-[11px] text-muted-foreground">{card.recipient_name} {card.recipient_phone ? `· ${card.recipient_phone}` : ''}</p>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-1 w-24 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pctUsed}%` }}/>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{pctUsed}% used</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="stat-number text-base font-black">{Number(card.current_balance).toFixed(3)} {currency}</p>
                  <p className="text-[10px] text-muted-foreground">of {Number(card.initial_balance).toFixed(3)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4 text-amber-500"/>{ar ? 'بطاقة هدية جديدة' : 'New Gift Card'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'الكود *' : 'Code *'}</Label>
              <div className="flex gap-2">
                <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="h-9 font-mono flex-1"/>
                <Button size="sm" variant="outline" className="h-9" onClick={() => setCode(genCode('GC-'))}>Gen</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'المبلغ *' : `Amount (${currency}) *`}</Label>
              <Input type="number" min="0.5" step="0.5" value={amount} onChange={e => setAmount(e.target.value)} className="h-9" placeholder="0.000"/>
            </div>
            <Separator/>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'اسم المستفيد' : "Recipient Name"}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="h-9" placeholder={ar ? 'اختياري' : 'Optional'}/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'رقم الهاتف' : 'Phone'}</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-9" placeholder={ar ? 'اختياري' : 'Optional'}/>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'تاريخ الانتهاء' : 'Expiry Date'}</Label>
              <Input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="h-9"/>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={create.isPending || !code || !amount} className="gap-1.5">
              {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Gift className="h-3.5 w-3.5"/>}
              {ar ? 'إنشاء البطاقة' : 'Create Card'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Promo Codes Tab ───────────────────────────────────────────
function PromoCodesTab({ currency, ar }: { currency: string; ar: boolean }) {
  const { data: promos = [], isLoading } = usePromoCodes();
  const create = useCreatePromoCode();
  const update = useUpdatePromoCode();
  const [open, setOpen]     = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);

  const blank = (): Omit<PromoCode,'id'|'tenant_id'|'usage_count'|'created_at'> => ({
    code: genCode('ZAINA'), description: '', discount_type: 'percentage',
    discount_value: 10, min_order_amount: 0, max_discount_cap: null,
    usage_limit: null, valid_from: new Date().toISOString().slice(0,16),
    valid_to: null, applies_to: 'all', is_active: true,
  });

  const [form, setForm] = useState<ReturnType<typeof blank>>(blank());

  const openNew = () => { setEditing(null); setForm(blank()); setOpen(true); };
  const openEdit = (p: PromoCode) => {
    setEditing(p);
    setForm({
      code: p.code, description: p.description||'', discount_type: p.discount_type,
      discount_value: p.discount_value, min_order_amount: p.min_order_amount,
      max_discount_cap: p.max_discount_cap, usage_limit: p.usage_limit,
      valid_from: p.valid_from.slice(0,16), valid_to: p.valid_to?.slice(0,16)||'',
      applies_to: p.applies_to, is_active: p.is_active,
    } as any);
    setOpen(true);
  };

  const handleSave = async () => {
    const payload = { ...form, code: form.code.toUpperCase(), valid_to: form.valid_to || null };
    if (editing) await update.mutateAsync({ id: editing.id, ...payload });
    else await create.mutateAsync(payload as any);
    setOpen(false);
  };

  const toggleActive = (p: PromoCode) => update.mutate({ id: p.id, is_active: !p.is_active });

  const exampleDisc = form.discount_type === 'percentage'
    ? `${form.discount_value}% off${form.max_discount_cap ? ` (max ${form.max_discount_cap} ${currency})` : ''}`
    : `${Number(form.discount_value).toFixed(3)} ${currency} off`;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{promos.filter(p=>p.is_active).length} {ar ? 'كود نشط' : 'active codes'} of {promos.length}</p>
        <Button size="sm" onClick={openNew} className="gap-1.5 h-9">
          <Plus className="h-3.5 w-3.5"/>{ar ? 'كود جديد' : 'New Code'}
        </Button>
      </div>

      {isLoading ? <LoadingState variant="rows" rows={4} /> : promos.length === 0 ? (
        <EmptyState
          icon={Tag}
          size="compact"
          title={ar ? 'لا توجد أكواد خصم' : 'No promo codes yet'}
          description={ar ? 'أنشئي أول كود خصم لتفعيل حملة ترويجية' : 'Create your first promo code to run a campaign or offer.'}
          action={{ label: ar ? 'كود جديد' : 'New Code', onClick: openNew }}
        />
      ) : (
        <div className="border rounded-md overflow-hidden divide-y divide-border">
          {promos.map(p => {
            const expired = p.valid_to && isPast(parseISO(p.valid_to));
            const limitReached = p.usage_limit && p.usage_count >= p.usage_limit;
            return (
              <div key={p.id} className={cn('flex items-center gap-4 px-5 py-4 bg-card', (!p.is_active||expired||limitReached) && 'opacity-55')}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-bold font-mono">{p.code}</p>
                    {p.discount_type === 'percentage'
                      ? <Badge className="text-[10px] h-5 px-1.5 gap-0.5 bg-primary/10 text-primary border-primary/20"><Percent className="h-2.5 w-2.5"/>{p.discount_value}%</Badge>
                      : <Badge className="text-[10px] h-5 px-1.5 gap-0.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"><Banknote className="h-2.5 w-2.5"/>{Number(p.discount_value).toFixed(3)}</Badge>}
                    {expired && <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-sm text-red-500 border-red-200">Expired</Badge>}
                    {limitReached && <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-sm">Limit reached</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {p.description || '—'} ·
                    {p.usage_limit ? ` ${p.usage_count}/${p.usage_limit} uses ·` : ` ${p.usage_count} uses ·`}
                    {p.min_order_amount > 0 ? ` min ${Number(p.min_order_amount).toFixed(3)} ${currency} ·` : ''}
                    {p.valid_to ? ` expires ${format(parseISO(p.valid_to),'MMM d, yyyy')}` : ' no expiry'}
                  </p>
                </div>
                <Switch checked={p.is_active && !expired && !limitReached} onCheckedChange={() => toggleActive(p)} className="scale-75"/>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground" onClick={() => openEdit(p)}>
                  <Edit2 className="h-3.5 w-3.5"/>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4 text-primary"/>{editing ? (ar ? 'تعديل الكود' : 'Edit Promo Code') : (ar ? 'كود خصم جديد' : 'New Promo Code')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold">Code *</Label>
                <div className="flex gap-2">
                  <Input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="h-9 font-mono flex-1"/>
                  <Button size="sm" variant="outline" className="h-9" onClick={() => setForm({...form, code: genCode('ZAINA')})}>Gen</Button>
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold">Description</Label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="h-9" placeholder="Eid offer, summer special..."/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Discount Type</Label>
                <Select value={form.discount_type} onValueChange={v => setForm({...form, discount_type: v})}>
                  <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">% Percentage</SelectItem>
                    <SelectItem value="flat">Flat {currency}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Discount Value *</Label>
                <Input type="number" min="0" step={form.discount_type==='percentage'?'1':'0.001'}
                  value={form.discount_value} onChange={e => setForm({...form, discount_value: Number(e.target.value)})} className="h-9"/>
              </div>
              {form.discount_type === 'percentage' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Max Discount Cap ({currency})</Label>
                  <Input type="number" min="0" step="0.001"
                    value={form.max_discount_cap ?? ''} onChange={e => setForm({...form, max_discount_cap: e.target.value ? Number(e.target.value) : null})}
                    className="h-9" placeholder="Unlimited"/>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Min Order ({currency})</Label>
                <Input type="number" min="0" step="0.001" value={form.min_order_amount}
                  onChange={e => setForm({...form, min_order_amount: Number(e.target.value)})} className="h-9"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Usage Limit</Label>
                <Input type="number" min="1" value={form.usage_limit ?? ''}
                  onChange={e => setForm({...form, usage_limit: e.target.value ? Number(e.target.value) : null})}
                  className="h-9" placeholder="Unlimited"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Valid From</Label>
                <Input type="datetime-local" value={form.valid_from}
                  onChange={e => setForm({...form, valid_from: e.target.value})} className="h-9 text-xs"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Valid To</Label>
                <Input type="datetime-local" value={(form.valid_to as any) ?? ''}
                  onChange={e => setForm({...form, valid_to: e.target.value || null} as any)} className="h-9 text-xs"/>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-xs">
              <p className="font-semibold text-primary/70 mb-1">Preview</p>
              <p>{exampleDisc}{form.min_order_amount > 0 ? ` on orders over ${Number(form.min_order_amount).toFixed(3)} ${currency}` : ''}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={create.isPending || update.isPending} className="gap-1.5 min-w-[110px]">
              {(create.isPending || update.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Tag className="h-3.5 w-3.5"/>}
              {editing ? 'Update' : 'Create Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
