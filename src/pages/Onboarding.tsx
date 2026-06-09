import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Check, Sparkles, ArrowRight, ArrowLeft, Scissors, Flower2, Crown, Eye,
  Loader2, Store, Users, ListChecks, Wallet, CalendarDays, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

/* ------------------------------------------------------------------ *
 * Onboarding Agent — tappable, template-driven setup.
 * Flow: agent asks up to 8 questions (mostly one tap each), then
 * provisions services + staff + GL mapping via a single RPC.
 * Preserves the proven completion path: tenant -> branch -> profile ->
 * role -> refreshProfile() BEFORE navigate (the loop-bug fix) + confetti.
 * ------------------------------------------------------------------ */

type TemplateService = {
  id: string; name: string; name_ar: string; category: string;
  base_price: number; duration: number; is_default: boolean; sort_order: number;
};
type Template = {
  id: string; template_key: string; name: string; name_ar: string;
  icon: string | null; sort_order: number;
  services: TemplateService[];
};

const TEMPLATE_ICONS: Record<string, any> = {
  Scissors, Sparkles, Flower2, Crown, Eye,
};

const KW_AREAS = ['Salmiya', 'Hawally', 'Kuwait City', 'Jahra', 'Ahmadi', 'Farwaniya', 'Mangaf', 'Fahaheel', 'Other'];

const PRICE_TIERS = [
  { key: 'budget',  label: 'Budget-friendly', labelAr: 'اقتصادي', note: '−20%', icon: '💰' },
  { key: 'mid',     label: 'Mid-range',       labelAr: 'متوسط',  note: 'Recommended', icon: '⚖️' },
  { key: 'premium', label: 'Premium',         labelAr: 'فاخر',   note: '+30%', icon: '💎' },
];

const COMMISSION_OPTS = [
  { key: 0,  label: 'No commission' },
  { key: 10, label: '10%' },
  { key: 15, label: '15%' },
  { key: 20, label: '20%' },
];

const STAFF_OPTS = [
  { key: 1,  label: 'Just me' },
  { key: 3,  label: '2–3' },
  { key: 6,  label: '4–6' },
  { key: 10, label: '7–10' },
  { key: 12, label: '10+' },
];

const DAYS = [
  { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' }, { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' }, { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
];

const HOURS_PRESETS = [
  { key: 'standard', label: 'Morning–Evening', open: '10:00', close: '22:00' },
  { key: 'late',     label: 'Afternoon–Late',  open: '14:00', close: '23:00' },
];

const TIER_MULT: Record<string, number> = { budget: 0.8, mid: 1.0, premium: 1.3, custom: 1.0 };

const STEPS = [
  { id: 1, title: 'Salon Type',  icon: Scissors,    desc: 'What kind of salon?' },
  { id: 2, title: 'Business',    icon: Store,       desc: 'Name & location' },
  { id: 3, title: 'Team',        icon: Users,       desc: 'How many staff?' },
  { id: 4, title: 'Services',    icon: ListChecks,  desc: 'What you offer' },
  { id: 5, title: 'Pricing',     icon: Wallet,      desc: 'Price tier & commission' },
  { id: 6, title: 'Hours',       icon: CalendarDays,desc: 'When you’re open' },
  { id: 7, title: 'Launch',      icon: Rocket,      desc: 'Review & go live' },
];

const Onboarding = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // ---- answers ----
  const [templateKeys, setTemplateKeys] = useState<string[]>([]);      // multi-select
  const [salonName, setSalonName] = useState('');
  const [area, setArea] = useState('Salmiya');
  const [currency] = useState('KWD');
  const [staffCount, setStaffCount] = useState<number>(3);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());    // toggle state (see isOn)
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({}); // lower-name -> custom price
  const [priceTier, setPriceTier] = useState<string>('mid');
  const [commission, setCommission] = useState<number>(10);
  const [workingDays, setWorkingDays] = useState<string[]>(['sat', 'sun', 'mon', 'tue', 'wed', 'thu']);
  const [hours, setHours] = useState(HOURS_PRESETS[0]);

  const selectedTemplates = useMemo(
    () => templates.filter(t => templateKeys.includes(t.template_key)),
    [templates, templateKeys]
  );

  // Catalog: all services from every selected template, deduped by name
  // (first occurrence wins). is_default decides initial on/off state.
  const catalog = useMemo(() => {
    const seen = new Set<string>();
    const out: TemplateService[] = [];
    for (const t of selectedTemplates) {
      for (const s of t.services) {
        const key = s.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(s);
      }
    }
    return out;
  }, [selectedTemplates]);

  // base (tier-adjusted) price for a service
  const tierPrice = (base: number) => +(base * (TIER_MULT[priceTier] ?? 1)).toFixed(3);
  // effective price: manual override wins, else tier price
  const effectivePrice = (s: TemplateService) => {
    const key = s.name.toLowerCase();
    return key in priceOverrides ? priceOverrides[key] : tierPrice(s.base_price);
  };
  // on/off: default-services are ON unless turned off; non-default are OFF
  // unless explicitly turned on. We track both with one Set using a prefix.
  const isOn = (s: TemplateService) => {
    const key = s.name.toLowerCase();
    return s.is_default ? !disabled.has(key) : disabled.has(`__on__${key}`);
  };

  // services the tenant will actually get
  const selectedServices = useMemo(
    () => catalog.filter(isOn),
    [catalog, disabled]
  );

  // ---- load templates + their services ----
  useEffect(() => {
    (async () => {
      setLoadingTemplates(true);
      const { data: tpl, error } = await supabase
        .from('salon_templates')
        .select('id, template_key, name, name_ar, icon, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      if (error || !tpl) { setLoadingTemplates(false); return; }

      const { data: svc } = await supabase
        .from('salon_template_services')
        .select('id, template_id, name, name_ar, category, base_price, duration, is_default, sort_order')
        .order('sort_order');

      const merged: Template[] = tpl.map((t: any) => ({
        ...t,
        services: (svc || []).filter((s: any) => s.template_id === t.id),
      }));
      setTemplates(merged);
      setLoadingTemplates(false);
    })();
  }, []);

  const canProceed = () => {
    if (step === 1) return templateKeys.length >= 1;
    if (step === 2) return salonName.trim().length >= 2;
    if (step === 4) return selectedServices.length >= 1;
    if (step === 6) return workingDays.length >= 1;
    return true;
  };

  const toggleTemplate = (key: string) => {
    setTemplateKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleService = (s: TemplateService) => {
    const key = s.name.toLowerCase();
    setDisabled(prev => {
      const next = new Set(prev);
      if (s.is_default) {
        next.has(key) ? next.delete(key) : next.add(key);          // default: toggle OFF marker
      } else {
        const onKey = `__on__${key}`;
        next.has(onKey) ? next.delete(onKey) : next.add(onKey);    // non-default: toggle ON marker
      }
      return next;
    });
  };

  const setServicePrice = (s: TemplateService, raw: string) => {
    const key = s.name.toLowerCase();
    const val = parseFloat(raw);
    setPriceOverrides(prev => {
      const next = { ...prev };
      if (raw === '' || isNaN(val)) delete next[key];
      else next[key] = +val.toFixed(3);
      return next;
    });
  };

  const toggleDay = (key: string) => {
    setWorkingDays(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );
  };

  const handleLaunch = async () => {
    if (!user || templateKeys.length === 0) return;
    setLoading(true);
    try {
      // 1. Atomically bootstrap tenant + branch + profile link + owner role.
      //    Done in one SECURITY DEFINER RPC to avoid the tenants SELECT-policy
      //    read-back failure (profile isn't linked to the tenant yet at the
      //    moment of a client-side insert().select()).
      const { data: boot, error: bootErr } = await supabase
        .rpc('bootstrap_tenant', {
          p_salon_name: salonName.trim(),
          p_currency: currency,
          p_branch_name: `${area} Branch`,
          p_branch_address: area === 'Other' ? null : `${area}, Kuwait`,
          p_opening_time: hours.open,
          p_closing_time: hours.close,
          p_working_days: workingDays,
        });
      if (bootErr) throw bootErr;

      const tenantId = (boot as any)?.tenant_id as string;
      const branchId = (boot as any)?.branch_id as string;
      if (!tenantId) throw new Error('Could not create salon. Please try again.');

      // 2. Provision services + staff + GL mapping via RPC.
      //    We send an explicit services list (selection + final price +
      //    duration already resolved client-side), plus template_keys for
      //    staff-role seeding. The RPC treats 'services' as authoritative.
      const answers = {
        template_keys: templateKeys,
        services: selectedServices.map(s => ({
          name: s.name,
          name_ar: s.name_ar,
          category: s.category,
          price: effectivePrice(s),
          duration: s.duration,
        })),
        price_tier: priceTier,
        commission_pct: commission,
        branch_id: branchId,
        working_days: workingDays,
        opening_time: hours.open,
        closing_time: hours.close,
        staff_count: staffCount,
      };
      const { data: provision, error: provErr } = await supabase
        .rpc('provision_tenant_from_template', {
          p_tenant_id: tenantId,
          p_answers: answers,
        });
      if (provErr) {
        // Non-fatal: tenant is usable; surface a soft warning.
        console.error('provision error:', provErr);
        toast.warning('Salon created — some services need manual setup. You can add them from the Services page.');
      }

      // 6. Refresh context BEFORE navigating (the loop-bug fix)
      await refreshProfile();

      const made = (provision as any)?.services_created ?? selectedServices.length;
      confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 }, colors: ['#C0395E', '#D4956A', '#ffffff'] });
      toast.success(`Welcome to ZAINA! ${made} services ready · 14-day trial started 🎉`);

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Onboarding error:', err);
      toast.error(err?.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;
  const StepIcon = STEPS[step - 1].icon;

  // reusable option-card button (Claude-style tappable)
  const OptionCard = ({
    active, onClick, children, className,
  }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative text-left rounded-xl border p-3.5 transition-all duration-150 active:scale-[0.98]',
        active
          ? 'border-primary bg-primary/8 ring-2 ring-primary/25'
          : 'border-border/70 bg-card hover:border-primary/40 hover:bg-primary/[0.03]',
        className
      )}
    >
      {active && (
        <span className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" />
        </span>
      )}
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border/60 flex items-center px-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Scissors className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>ZAINA Setup</span>
        </div>
        <div className="ml-auto text-xs text-muted-foreground font-medium">Step {step} of {STEPS.length}</div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1fr_320px] max-w-5xl w-full mx-auto px-6 py-10 gap-8">
        {/* ---- main column ---- */}
        <div className="w-full max-w-lg mx-auto lg:mx-0">
          {/* progress */}
          <div className="mb-7">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 pt-6 pb-5 border-b border-border/50 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <StepIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>{STEPS[step - 1].title}</h2>
                <p className="text-sm text-muted-foreground">{STEPS[step - 1].desc}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Q1 — salon type(s), multi-select */}
              {step === 1 && (
                loadingTemplates ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading salon types…
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Pick one or more — services from each are combined for you.</p>
                    <div className="grid grid-cols-2 gap-3">
                      {templates.map(t => {
                        const Icon = TEMPLATE_ICONS[t.icon || 'Sparkles'] || Sparkles;
                        return (
                          <OptionCard key={t.id} active={templateKeys.includes(t.template_key)}
                            onClick={() => toggleTemplate(t.template_key)}>
                            <Icon className="h-5 w-5 text-primary mb-2" />
                            <div className="font-semibold text-sm">{t.name}</div>
                            <div className="text-xs text-muted-foreground" dir="rtl">{t.name_ar}</div>
                          </OptionCard>
                        );
                      })}
                    </div>
                    {templateKeys.length > 1 && (
                      <p className="text-[11px] text-primary">{templateKeys.length} types selected · duplicate services are merged.</p>
                    )}
                  </>
                )
              )}

              {/* Q2 — business */}
              {step === 2 && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="salonName">Salon Name *</Label>
                    <Input id="salonName" placeholder="e.g., Glam Studio Kuwait" value={salonName}
                      onChange={e => setSalonName(e.target.value)} className="h-10" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Area</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {KW_AREAS.map(a => (
                        <button key={a} type="button" onClick={() => setArea(a)}
                          className={cn('rounded-lg border px-2 py-2 text-xs font-medium transition-all',
                            area === a ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 hover:border-primary/40')}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/6 border border-primary/20 text-xs text-primary">
                    💡 Currency is set to KWD. You can change tax & currency later in Settings.
                  </div>
                </>
              )}

              {/* Q3 — staff count */}
              {step === 3 && (
                <div className="grid grid-cols-2 gap-3">
                  {STAFF_OPTS.map(o => (
                    <OptionCard key={o.key} active={staffCount === o.key} onClick={() => setStaffCount(o.key)}>
                      <Users className="h-4 w-4 text-primary mb-1.5" />
                      <div className="font-semibold text-sm">{o.label}</div>
                    </OptionCard>
                  ))}
                </div>
              )}

              {/* Q4 — services: toggle on/off + edit price */}
              {step === 4 && catalog.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Tap a row to add/remove · edit any price.</p>
                    <span className="text-xs font-medium text-primary">{selectedServices.length} on</span>
                  </div>
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {catalog.map(s => {
                      const on = isOn(s);
                      const key = s.name.toLowerCase();
                      const overridden = key in priceOverrides;
                      return (
                        <div key={s.id}
                          className={cn('flex items-center gap-3 rounded-xl border p-3 transition-all',
                            on ? 'border-primary/50 bg-primary/[0.04]' : 'border-border/60 opacity-60')}>
                          <button type="button" onClick={() => toggleService(s)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                            <span className={cn('h-5 w-5 rounded-md flex items-center justify-center shrink-0',
                              on ? 'bg-primary text-primary-foreground' : 'border border-border')}>
                              {on && <Check className="h-3 w-3" />}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium truncate">{s.name}</span>
                              <span className="block text-xs text-muted-foreground">{s.duration} min{overridden ? ' · custom price' : ''}</span>
                            </span>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <Input
                              type="number" min="0" step="0.5" inputMode="decimal"
                              disabled={!on}
                              value={effectivePrice(s)}
                              onChange={e => setServicePrice(s, e.target.value)}
                              className="h-8 w-20 text-right tabular-nums text-sm px-2"
                            />
                            <span className="text-[10px] text-muted-foreground">KWD</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Q5 — pricing + commission */}
              {step === 5 && (
                <>
                  <div>
                    <Label className="mb-2 block">Price tier</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {PRICE_TIERS.map(t => (
                        <OptionCard key={t.key} active={priceTier === t.key} onClick={() => setPriceTier(t.key)} className="text-center">
                          <div className="text-lg">{t.icon}</div>
                          <div className="font-semibold text-xs mt-1">{t.label}</div>
                          <div className="text-[10px] text-muted-foreground">{t.note}</div>
                        </OptionCard>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Staff commission</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {COMMISSION_OPTS.map(c => (
                        <button key={c.key} type="button" onClick={() => setCommission(c.key)}
                          className={cn('rounded-lg border px-2 py-2.5 text-xs font-medium transition-all',
                            commission === c.key ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 hover:border-primary/40')}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Q6 — hours */}
              {step === 6 && (
                <>
                  <div>
                    <Label className="mb-2 block">Working days</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map(d => (
                        <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                          className={cn('rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                            workingDays.includes(d.key) ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 hover:border-primary/40')}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Hours</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {HOURS_PRESETS.map(h => (
                        <OptionCard key={h.key} active={hours.key === h.key} onClick={() => setHours(h)}>
                          <div className="font-semibold text-sm">{h.label}</div>
                          <div className="text-xs text-muted-foreground">{h.open} – {h.close}</div>
                        </OptionCard>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Q7 — review */}
              {step === 7 && selectedTemplates.length > 0 && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border/60 divide-y divide-border/50 text-sm">
                    <Row label="Salon" value={salonName || '—'} />
                    <Row label="Type" value={selectedTemplates.map(t => t.name).join(', ')} />
                    <Row label="Area" value={area} />
                    <Row label="Services" value={`${selectedServices.length} ready`} />
                    <Row label="Pricing" value={PRICE_TIERS.find(t => t.key === priceTier)?.label || 'Mid'} />
                    <Row label="Commission" value={commission === 0 ? 'None' : `${commission}%`} />
                    <Row label="Open" value={`${workingDays.length} days · ${hours.open}–${hours.close}`} />
                  </div>
                  <div className="p-3 rounded-xl bg-primary/6 border border-primary/20 text-xs text-primary">
                    ✨ Everything below maps to your finances automatically — services post to the right revenue accounts the moment you make your first sale.
                  </div>
                </div>
              )}
            </div>

            {/* footer nav */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} disabled={step === 1} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />Back
              </Button>
              {step < STEPS.length ? (
                <Button size="sm" onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="gap-1.5">
                  Next<ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" onClick={handleLaunch} disabled={loading} className="gap-1.5">
                  {loading
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Setting up…</>
                    : <><Rocket className="h-3.5 w-3.5" />Launch Salon</>}
                </Button>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            14-day free trial · No credit card required
          </p>
        </div>

        {/* ---- live preview ---- */}
        <aside className="hidden lg:block">
          <div className="sticky top-10 rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Live Preview</span>
            </div>
            {selectedTemplates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Pick a salon type to see your starter setup build here.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Salon</div>
                  <div className="text-sm font-semibold">{salonName || 'Your Salon'}</div>
                  <div className="text-xs text-muted-foreground">{selectedTemplates.map(t => t.name).join(' + ')} · {area}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Services ({selectedServices.length})</div>
                  <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                    {selectedServices.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-foreground/80">{s.name}</span>
                        <span className="font-medium text-primary tabular-nums ml-2">{effectivePrice(s).toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between px-3.5 py-2.5">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default Onboarding;
