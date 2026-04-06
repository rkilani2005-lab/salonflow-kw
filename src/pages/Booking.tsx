import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Clock, CheckCircle2, Scissors, ChevronRight, User,
  Sparkles, Calendar as CalendarIcon, Phone, Mail, ArrowLeft,
  Star, Crown, Gift, History, ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface Service { id:string; name:string; name_ar:string|null; category:string; duration:number; price:number; deposit_required:boolean; deposit_amount:number; color:string; }
interface Staff  { id:string; name:string; name_ar:string|null; color:string; working_hours_start:string; working_hours_end:string; }
interface ClientData {
  id:string; name:string; email:string|null; phone:string;
  loyaltyPoints:number; tier:string; totalVisits:number; totalSpent:number;
  lastVisit:string|null; lastService:string|null;
  activePackages:{ sessions_remaining:number; package:{ name:string } }[];
}

type Step = 'phone' | 'service' | 'datetime' | 'details' | 'success';

const CATEGORY_LABELS: Record<string,{ en:string; ar:string; emoji:string }> = {
  hair:    { en:'Hair',    ar:'شعر',       emoji:'✂️' },
  nails:   { en:'Nails',   ar:'أظافر',     emoji:'💅' },
  facial:  { en:'Facial',  ar:'بشرة',      emoji:'🧖‍♀️' },
  makeup:  { en:'Makeup',  ar:'مكياج',     emoji:'💄' },
  waxing:  { en:'Waxing',  ar:'إزالة شعر', emoji:'🪒' },
  massage: { en:'Massage', ar:'مساج',      emoji:'💆‍♀️' },
  other:   { en:'Other',   ar:'أخرى',      emoji:'✨' },
};

const TIER_CONFIG: Record<string,{ label:string; icon:React.ReactNode; color:string }> = {
  normal: { label:'Client',  icon:null,                                        color:'text-muted-foreground' },
  vip:    { label:'VIP',     icon:<Star    className="h-3 w-3 fill-current"/>, color:'text-amber-600' },
  vvip:   { label:'VVIP',   icon:<Crown   className="h-3 w-3 fill-current"/>, color:'text-primary' },
};

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const tenantId = searchParams.get('tenant');
  const lang = searchParams.get('lang') === 'ar' ? 'ar' : 'en';
  const ar = lang === 'ar';

  // Flow state
  const [step,             setStep]             = useState<Step>('phone');
  const [services,         setServices]         = useState<Service[]>([]);
  const [staff,            setStaff]            = useState<Staff[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [submitting,       setSubmitting]       = useState(false);

  // Client recognition
  const [phoneInput,       setPhoneInput]       = useState('');
  const [lookingUp,        setLookingUp]        = useState(false);
  const [foundClient,      setFoundClient]      = useState<ClientData | null>(null);
  const [isNewClient,      setIsNewClient]      = useState(false);
  const [showHistory,      setShowHistory]      = useState(false);

  // Booking selections
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedService,  setSelectedService]  = useState<Service | null>(null);
  const [selectedStaff,    setSelectedStaff]    = useState<Staff | null>(null);
  const [selectedDate,     setSelectedDate]     = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedTime,     setSelectedTime]     = useState('');

  // Client details (pre-filled for returning clients)
  const [clientName,       setClientName]       = useState('');
  const [clientPhone,      setClientPhone]      = useState('');
  const [clientEmail,      setClientEmail]      = useState('');

  // Success
  const [bookingRef,       setBookingRef]       = useState('');
  const [portalToken,      setPortalToken]      = useState('');

  useEffect(() => {
    if (tenantId) loadData();
    else setLoading(false);
    // Handle payment callback
    const bookingId = searchParams.get('booking');
    const token = searchParams.get('token');
    if (bookingId && window.location.pathname.includes('success')) {
      setStep('success');
      setBookingRef(bookingId.slice(-6).toUpperCase());
      if (token) setPortalToken(token);
    }
  }, [tenantId]);

  const loadData = async () => {
    try {
      const [sRes, stRes] = await Promise.all([
        supabase.functions.invoke('create-public-booking', { body: { action: 'get-services', tenantId } }),
        supabase.functions.invoke('create-public-booking', { body: { action: 'get-staff',    tenantId } }),
      ]);
      if (sRes.data?.services) setServices(sRes.data.services);
      if (stRes.data?.staff)   setStaff(stRes.data.staff);
    } catch { /* fail silently */ }
    finally { setLoading(false); }
  };

  // Phone lookup
  const handlePhoneLookup = async () => {
    const phone = phoneInput.trim();
    if (!phone) return;
    setLookingUp(true);
    try {
      const { data } = await supabase.functions.invoke('create-public-booking', {
        body: { action: 'lookup-client', tenantId, clientPhone: phone },
      });
      if (data?.found && data?.client) {
        setFoundClient(data.client);
        setClientName(data.client.name);
        setClientPhone(data.client.phone);
        setClientEmail(data.client.email || '');
        setIsNewClient(false);
      } else {
        setFoundClient(null);
        setClientPhone(phone);
        setIsNewClient(true);
      }
      setStep('service');
    } catch {
      toast({ title: ar ? 'خطأ' : 'Error', variant: 'destructive' });
    } finally { setLookingUp(false); }
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    const startH = selectedStaff ? parseInt(selectedStaff.working_hours_start.split(':')[0]) : 9;
    const endH   = selectedStaff ? parseInt(selectedStaff.working_hours_end.split(':')[0])   : 21;
    for (let h = startH; h < endH; h++) {
      slots.push(`${h.toString().padStart(2,'0')}:00`);
      slots.push(`${h.toString().padStart(2,'0')}:30`);
    }
    return slots;
  };

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !clientName || !clientPhone) {
      toast({ title: ar ? 'معلومات ناقصة' : 'Missing Information', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('create-public-booking', {
        body: {
          action: 'create-booking', tenantId,
          serviceId: selectedService.id, staffId: selectedStaff?.id || null,
          bookingDate: format(selectedDate, 'yyyy-MM-dd'), startTime: selectedTime,
          clientName: clientName.trim(), clientPhone: clientPhone.replace(/\s/g,''),
          clientEmail: clientEmail || undefined,
        },
      });
      if (response.data?.error) throw new Error(response.data.error);
      if (response.data?.requiresPayment && response.data?.paymentUrl) {
        window.location.href = response.data.paymentUrl; return;
      }
      setBookingRef(response.data?.bookingId?.slice(-6).toUpperCase() || 'ZAINA');
      setPortalToken(response.data?.portalToken || '');
      setIsNewClient(response.data?.isNewClient ?? false);
      setStep('success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Please try again.';
      toast({ title: ar ? 'فشل الحجز' : 'Booking Failed', description: msg, variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const categories = ['all', ...Array.from(new Set(services.map(s => s.category)))];
  const filteredServices = selectedCategory === 'all' ? services : services.filter(s => s.category === selectedCategory);
  const stepConfig = [
    { id: 'phone',    label: ar ? 'هويتك'  : 'Who are you?', icon: Phone },
    { id: 'service',  label: ar ? 'الخدمة' : 'Service',      icon: Scissors },
    { id: 'datetime', label: ar ? 'الموعد' : 'Date/Time',    icon: CalendarIcon },
    { id: 'details',  label: ar ? 'التأكيد': 'Confirm',      icon: User },
  ];
  const currentStepIdx = stepConfig.findIndex(s => s.id === step);

  if (!tenantId) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Scissors className="h-8 w-8 text-primary"/>
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ fontFamily:'Syne,sans-serif' }}>Online Booking</h1>
        <p className="text-muted-foreground mb-6 text-sm">Use the booking link provided by your salon.</p>
        <Link to="/"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4"/>Back to Home</Button></Link>
      </div>
    </div>
  );

  // ── Success screen ─────────────────────────────────────────
  if (step === 'success') {
    const portalUrl = portalToken ? `${window.location.origin}/portal?tenant=${tenantId}&token=${portalToken}` : null;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6" dir={ar?'rtl':'ltr'}>
        <div className="w-full max-w-sm space-y-5">
          {/* Celebration */}
          <div className="text-center">
            <div className="relative mx-auto mb-4 w-fit">
              <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500"/>
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-amber-500 animate-pulse"/>
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ fontFamily:'Syne,sans-serif' }}>
              {ar ? 'تم الحجز بنجاح! 🎉' : 'Booking Confirmed! 🎉'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ar ? 'سنرسل لك تأكيداً عبر واتساب قريباً.' : "We'll send a WhatsApp confirmation shortly."}
            </p>
          </div>

          {/* Booking card */}
          <div className="bg-muted/40 rounded-2xl p-5" dir="ltr">
            <p className="text-xs text-muted-foreground mb-1">Booking Reference</p>
            <p className="text-3xl font-bold tracking-widest text-primary stat-number">#{bookingRef}</p>
            {selectedService && selectedDate && selectedTime && (
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <p>📋 {selectedService.name}</p>
                <p>📅 {format(selectedDate, 'EEEE, MMM d, yyyy')}</p>
                <p>🕐 {selectedTime}</p>
                {selectedStaff && <p>👩‍🎨 {selectedStaff.name}</p>}
              </div>
            )}
          </div>

          {/* Portal CTA — different for new vs returning */}
          {portalUrl && (
            <div className={cn(
              'rounded-2xl p-4 border',
              isNewClient
                ? 'bg-primary/5 border-primary/20'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
            )}>
              {isNewClient ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-primary"/>
                    <p className="font-semibold text-sm">{ar ? 'أكملي ملفك الشخصي!' : 'Complete your profile!'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {ar
                      ? 'أنشئي حسابك لمتابعة مواعيدك ونقاط الولاء والعروض الخاصة.'
                      : 'Create your account to track appointments, earn loyalty points, and get exclusive offers.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-400"/>
                    <p className="font-semibold text-sm">
                      {ar
                        ? `لديكِ ${foundClient?.loyaltyPoints || 0} نقطة ولاء 🎁`
                        : `You have ${foundClient?.loyaltyPoints || 0} loyalty points 🎁`}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {ar
                      ? 'شاهدي مواعيدك القادمة وتاريخ زياراتك ونقاطك.'
                      : 'View your upcoming bookings, visit history, and points.'}
                  </p>
                </>
              )}
              <Button className="w-full gap-2" size="sm"
                onClick={() => navigate(`/portal?tenant=${tenantId}&token=${portalToken}`)}>
                {isNewClient
                  ? (ar ? 'أكملي ملفك الشخصي ←' : 'Complete My Profile →')
                  : (ar ? 'بوابتي الشخصية ←' : 'View My Portal →')}
              </Button>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => {
            setStep('phone'); setSelectedService(null); setSelectedTime('');
            setClientName(''); setClientPhone(''); setClientEmail('');
            setFoundClient(null); setPhoneInput(''); setIsNewClient(false);
          }}>
            {ar ? 'حجز موعد آخر' : 'Book Another Appointment'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={ar?'rtl':'ltr'}>
      {/* Header */}
      <header className="border-b border-border/60 bg-background/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
              <Scissors className="h-4 w-4 text-primary-foreground"/>
            </div>
            <span className="font-bold text-sm" style={{ fontFamily:'Syne,sans-serif' }}>
              {ar ? 'احجزي موعدك' : 'Book Appointment'}
            </span>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1">
            {stepConfig.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                  i < currentStepIdx ? 'bg-primary text-primary-foreground' :
                  i === currentStepIdx ? 'bg-primary/15 text-primary ring-1 ring-primary/40' :
                  'bg-muted text-muted-foreground'
                )}>
                  {i < currentStepIdx ? '✓' : i + 1}
                </div>
                {i < stepConfig.length - 1 && (
                  <div className={cn('h-px w-3', i < currentStepIdx ? 'bg-primary' : 'bg-muted')}/>
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* ── STEP 0: Phone identification ── */}
        {step === 'phone' && (
          <div className="space-y-8 max-w-sm mx-auto">
            <div className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Phone className="h-8 w-8 text-primary"/>
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily:'Syne,sans-serif' }}>
                {ar ? 'أهلاً! ما رقمك؟' : 'Welcome! What\'s your number?'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {ar
                  ? 'نستخدم رقمك لتحديد هويتك وتسريع عملية الحجز'
                  : 'We use your phone number to recognise you and pre-fill your details'}
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{ar ? 'رقم الهاتف' : 'Phone Number'}</Label>
                  <Input
                    dir="ltr"
                    placeholder="+965 9XXX XXXX"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePhoneLookup()}
                    className="h-12 text-base text-center tracking-wider"
                    autoFocus
                  />
                </div>
                <Button onClick={handlePhoneLookup} disabled={!phoneInput.trim() || lookingUp}
                  className="w-full h-12 text-base font-semibold gap-2">
                  {lookingUp
                    ? <><Loader2 className="h-4 w-4 animate-spin"/>{ar?'جارٍ البحث...':'Checking...'}</>
                    : <>{ar?'متابعة':'Continue'}<ChevronRight className={`h-4 w-4 ${ar?'rotate-180':''}`}/></>}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  {ar ? 'بياناتك محمية ولن تُشارك مع أي طرف ثالث' : 'Your data is private and never shared'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 1: Service (with returning client banner) ── */}
        {step === 'service' && (
          <div className="space-y-6">
            {/* Returning client welcome card */}
            {foundClient && (
              <div className="rounded-2xl border bg-gradient-to-r from-primary/5 to-amber-500/5 border-primary/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary">
                      {foundClient.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm">{ar?`أهلاً ${foundClient.name}! 👋`:`Welcome back, ${foundClient.name}! 👋`}</p>
                        {foundClient.tier !== 'normal' && (
                          <span className={cn('text-xs font-bold', TIER_CONFIG[foundClient.tier]?.color)}>
                            {TIER_CONFIG[foundClient.tier]?.icon}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {foundClient.totalVisits} {ar?'زيارة':'visits'} · {foundClient.totalSpent.toFixed(3)} KWD
                      </p>
                    </div>
                  </div>
                  {/* Loyalty points */}
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="h-4 w-4 fill-amber-400"/>
                      <span className="font-black stat-number text-base">{foundClient.loyaltyPoints}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{ar?'نقاط':'points'}</p>
                  </div>
                </div>

                {/* Active packages */}
                {foundClient.activePackages.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-1">
                    {foundClient.activePackages.map((p, i) => (
                      <Badge key={i} className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
                        <Gift className="h-2.5 w-2.5"/>
                        {p.package.name} ({p.sessions_remaining} {ar?'جلسات باقية':'sessions left'})
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Last visit */}
                {foundClient.lastVisit && (
                  <button className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2 hover:text-foreground transition-colors"
                    onClick={() => setShowHistory(h => !h)}>
                    <History className="h-3 w-3"/>
                    {ar?`آخر زيارة: ${foundClient.lastService}`:`Last visit: ${foundClient.lastService}`}
                    · {foundClient.lastVisit}
                    {showHistory ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
                  </button>
                )}
              </div>
            )}

            {/* New client prompt */}
            {isNewClient && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5"/>
                  <div>
                    <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">
                      {ar ? 'يسعدنا استقبالك لأول مرة! ✨' : 'First time here! Welcome! ✨'}
                    </p>
                    <p className="text-xs text-blue-700/80 dark:text-blue-400 mt-0.5">
                      {ar
                        ? 'سنقوم بإنشاء ملفك الشخصي بعد الحجز. ستحصلين على نقاط ولاء مع كل زيارة.'
                        : "We'll create your profile after booking. You'll earn loyalty points on every visit."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => { setStep('phone'); setFoundClient(null); setIsNewClient(false); }}
                  className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
                  <ArrowLeft className={`h-4 w-4 ${ar?'rotate-180':''}`}/>
                </button>
                <div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily:'Syne,sans-serif' }}>
                    {ar ? 'اختاري الخدمة' : 'Choose a Service'}
                  </h2>
                </div>
              </div>

              {/* Category filter */}
              {categories.length > 2 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none mb-4">
                  {categories.map(cat => {
                    const info = CATEGORY_LABELS[cat];
                    return (
                      <button key={cat} onClick={() => setSelectedCategory(cat)}
                        className={cn('flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border',
                          selectedCategory === cat
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-muted-foreground hover:border-primary/40')}>
                        {info?.emoji} {cat==='all' ? (ar?'الكل':'All') : (ar?info?.ar:info?.en) || cat}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Service grid */}
              <div className="grid gap-3">
                {filteredServices.map(svc => {
                  const isSelected = selectedService?.id === svc.id;
                  return (
                    <button key={svc.id} onClick={() => setSelectedService(svc)}
                      className={cn('w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40')}>
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: svc.color ? `${svc.color}20` : 'hsl(var(--muted))' }}>
                        {CATEGORY_LABELS[svc.category]?.emoji || '✨'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{ar && svc.name_ar ? svc.name_ar : svc.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3 w-3"/>{svc.duration} {ar?'دقيقة':'min'}
                          {svc.deposit_required && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-full">
                              {ar?'عربون مطلوب':'Deposit req.'}
                            </Badge>
                          )}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-primary">{svc.price.toFixed(3)}</p>
                        <p className="text-[10px] text-muted-foreground">KWD</p>
                      </div>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0"/>}
                    </button>
                  );
                })}
              </div>

              {/* Staff picker */}
              {staff.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold mb-3">{ar?'اختاري الموظفة (اختياري)':'Choose a Stylist (optional)'}</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setSelectedStaff(null)}
                      className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                        !selectedStaff ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/40')}>
                      {ar?'أي موظفة':'Any Stylist'}
                    </button>
                    {staff.map(s => (
                      <button key={s.id} onClick={() => setSelectedStaff(s)}
                        className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                          selectedStaff?.id === s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/40')}>
                        {ar && s.name_ar ? s.name_ar : s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={() => setStep('datetime')} disabled={!selectedService} className="w-full h-12 gap-2 text-base font-semibold mt-5">
                {ar?'متابعة':'Continue'}<ChevronRight className={`h-4 w-4 ${ar?'rotate-180':''}`}/>
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Date & Time ── */}
        {step === 'datetime' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('service')}
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ArrowLeft className={`h-4 w-4 ${ar?'rotate-180':''}`}/>
              </button>
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily:'Syne,sans-serif' }}>{ar?'اختاري الموعد':'Pick a Date & Time'}</h2>
                <p className="text-xs text-muted-foreground">{selectedService?.name}</p>
              </div>
            </div>
            <div className="flex justify-center">
              <Calendar mode="single" selected={selectedDate}
                onSelect={d => { setSelectedDate(d); setSelectedTime(''); }}
                disabled={d => isBefore(d, startOfDay(new Date()))}
                className="rounded-2xl border border-border p-4"/>
            </div>
            {selectedDate && (
              <div>
                <p className="text-sm font-semibold mb-3">{ar?'اختاري الوقت':'Available Times'}</p>
                <div className="grid grid-cols-4 gap-2">
                  {generateTimeSlots().map(slot => (
                    <button key={slot} onClick={() => setSelectedTime(slot)}
                      className={cn('py-2 rounded-xl text-sm font-medium border transition-all',
                        selectedTime === slot ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:border-primary/40')}>
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={() => setStep('details')} disabled={!selectedDate || !selectedTime}
              className="w-full h-12 gap-2 text-base font-semibold">
              {ar?'متابعة':'Continue'}<ChevronRight className={`h-4 w-4 ${ar?'rotate-180':''}`}/>
            </Button>
          </div>
        )}

        {/* ── STEP 3: Details & Confirm ── */}
        {step === 'details' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('datetime')}
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ArrowLeft className={`h-4 w-4 ${ar?'rotate-180':''}`}/>
              </button>
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily:'Syne,sans-serif' }}>{ar?'تأكيد الحجز':'Confirm Booking'}</h2>
                <p className="text-xs text-muted-foreground">{ar?'خطوة أخيرة!':'Almost done!'}</p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/40 rounded-2xl p-4 space-y-2 text-sm">
              <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-3">{ar?'ملخص الحجز':'Booking Summary'}</p>
              {[
                { icon: Scissors,     label: ar?'الخدمة':'Service',  val: selectedService?.name || '' },
                { icon: CalendarIcon, label: ar?'التاريخ':'Date',    val: selectedDate ? format(selectedDate,'EEEE, MMM d, yyyy') : '' },
                { icon: Clock,        label: ar?'الوقت':'Time',      val: selectedTime },
                { icon: User,         label: ar?'الموظفة':'Stylist', val: selectedStaff?.name || (ar?'أي موظفة':'Any Available') },
              ].filter(r => r.val).map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <row.icon className="h-3.5 w-3.5"/>{row.label}
                  </div>
                  <span className="font-medium">{row.val}</span>
                </div>
              ))}
              <div className="border-t border-border/60 pt-2 flex items-center justify-between font-semibold">
                <span>{ar?'الإجمالي':'Total'}</span>
                <span className="text-primary">{selectedService?.price.toFixed(3)} KWD</span>
              </div>
            </div>

            {/* Pre-filled notice for returning clients */}
            {foundClient && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0"/>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  {ar ? 'تم ملء بياناتك تلقائياً من حسابك.' : 'Your details are pre-filled from your account.'}
                </p>
              </div>
            )}

            {/* Form — pre-filled for returning clients */}
            <div className="space-y-4">
              {[
                { label: ar?'الاسم الكامل *':'Full Name *', val: clientName, set: setClientName, type:'text', placeholder: ar?'اسمك الكامل':'Your full name', required:true },
                { label: ar?'رقم الهاتف *':'Phone Number *', val: clientPhone, set: setClientPhone, type:'tel', placeholder:'+965 9XXX XXXX', required:true, dir:'ltr' },
                { label: ar?'البريد الإلكتروني':'Email (optional)', val: clientEmail, set: setClientEmail, type:'email', placeholder:'you@email.com', required:false, dir:'ltr' },
              ].map(f => (
                <div key={f.label} className="space-y-1.5">
                  <Label className="text-sm font-medium">{f.label}</Label>
                  <Input type={f.type} placeholder={f.placeholder} value={f.val}
                    onChange={e => f.set(e.target.value)} className="h-11" dir={f.dir}
                    readOnly={!!foundClient && f.val === clientPhone}/>
                </div>
              ))}
            </div>

            <Button onClick={handleSubmit}
              disabled={submitting || !clientName.trim() || !clientPhone.trim()}
              className="w-full h-12 gap-2 text-base font-semibold">
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin"/>{ar?'جارٍ الحجز...':'Booking...'}</>
                : <>{selectedService?.deposit_required ? (ar?'ادفعي العربون واحجزي':'Pay Deposit & Book') : (ar?'تأكيد الحجز':'Confirm Booking')}<Sparkles className="h-4 w-4"/></>}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {ar ? 'سيتم إرسال تأكيد واتساب على رقمك' : "You'll receive a WhatsApp confirmation at your number"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
