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
  AlertCircle, RefreshCw,
} from 'lucide-react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatPhoneInput, isValidKuwaitPhone } from '@/lib/phoneUtils';

// ─── Types ────────────────────────────────────────────────────
interface Service {
  id: string; name: string; name_ar: string | null;
  category: string; duration: number; price: number;
  deposit_required: boolean; deposit_amount: number; color: string;
}
interface Staff {
  id: string; name: string; name_ar: string | null; color: string;
  working_hours_start: string; working_hours_end: string;
}
interface ClientData {
  id: string; name: string; email: string | null; phone: string;
  loyaltyPoints: number; tier: string;
  totalVisits: number; totalSpent: number;
  lastVisit: string | null; lastService: string | null;
  activePackages: { sessions_remaining: number; package: { name: string } }[];
}

type Step = 'phone' | 'service' | 'datetime' | 'details' | 'success';

// ─── Constants ────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, { en: string; ar: string; emoji: string }> = {
  hair:    { en: 'Hair',    ar: 'شعر',        emoji: '✂️' },
  nails:   { en: 'Nails',   ar: 'أظافر',      emoji: '💅' },
  facial:  { en: 'Facial',  ar: 'بشرة',       emoji: '🧖‍♀️' },
  makeup:  { en: 'Makeup',  ar: 'مكياج',      emoji: '💄' },
  waxing:  { en: 'Waxing',  ar: 'إزالة شعر',  emoji: '🪒' },
  massage: { en: 'Massage', ar: 'مساج',       emoji: '💆‍♀️' },
  other:   { en: 'Other',   ar: 'أخرى',       emoji: '✨' },
};

const TIER_CFG: Record<string, { label: string; color: string; bg: string }> = {
  normal: { label: 'Client', color: 'text-muted-foreground', bg: 'bg-muted/40' },
  vip:    { label: 'VIP',    color: 'text-amber-600',        bg: 'bg-amber-50 dark:bg-amber-950/30' },
  vvip:   { label: 'VVIP',   color: 'text-primary',          bg: 'bg-primary/5' },
};

// ─── Main component ───────────────────────────────────────────
export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const tenantId = searchParams.get('tenant');
  const lang = searchParams.get('lang') === 'ar' ? 'ar' : 'en';
  const ar = lang === 'ar';

  // Flow
  const [step,            setStep]           = useState<Step>('phone');
  const [services,        setServices]       = useState<Service[]>([]);
  const [staff,           setStaff]          = useState<Staff[]>([]);
  const [loading,         setLoading]        = useState(true);
  const [submitting,      setSubmitting]     = useState(false);

  // Phone lookup
  const [phoneInput,      setPhoneInput]     = useState('');
  const [lookingUp,       setLookingUp]      = useState(false);
  const [foundClient,     setFoundClient]    = useState<ClientData | null>(null);
  const [isNewClient,     setIsNewClient]    = useState(false);
  const [showStats,       setShowStats]      = useState(false);

  // Booking selections
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedService,  setSelectedService]  = useState<Service | null>(null);
  const [selectedStaff,    setSelectedStaff]    = useState<Staff | null>(null);
  const [selectedDate,     setSelectedDate]     = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedTime,     setSelectedTime]     = useState('');

  // Client details (pre-filled for returning clients)
  const [clientName,  setClientName]  = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  // Success
  const [bookingRef,  setBookingRef]  = useState('');
  const [portalToken, setPortalToken] = useState('');

  useEffect(() => {
    if (tenantId) loadData();
    else setLoading(false);
    // Handle MyFatoorah payment callback
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

  // Phone lookup → identify returning vs new client
  const handlePhoneLookup = async () => {
    const phone = phoneInput.trim();
    if (!phone) return;
    setLookingUp(true);
    try {
      const { data } = await supabase.functions.invoke('create-public-booking', {
        body: { action: 'lookup-client', tenantId, clientPhone: phone },
      });
      if (data?.found && data?.client) {
        // ── Returning client: pre-fill everything ──
        const c = data.client as ClientData;
        setFoundClient(c);
        setClientName(c.name);
        setClientPhone(c.phone);
        setClientEmail(c.email || '');
        setIsNewClient(false);
      } else {
        // ── New client: only phone is known ──
        setFoundClient(null);
        setClientPhone(phone);
        setClientName('');
        setClientEmail('');
        setIsNewClient(true);
      }
      setStep('service');
    } catch {
      toast({ title: ar ? 'خطأ في الاتصال' : 'Connection error', variant: 'destructive' });
    } finally { setLookingUp(false); }
  };

  // Reset to start — "not you?" link
  const resetIdentity = () => {
    setFoundClient(null);
    setIsNewClient(false);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setPhoneInput('');
    setShowStats(false);
    setStep('phone');
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    const startH = selectedStaff ? parseInt(selectedStaff.working_hours_start.split(':')[0]) : 9;
    const endH   = selectedStaff ? parseInt(selectedStaff.working_hours_end.split(':')[0])   : 21;
    for (let h = startH; h < endH; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !clientName.trim() || !clientPhone.trim()) {
      toast({ title: ar ? 'معلومات ناقصة' : 'Missing Information', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('create-public-booking', {
        body: {
          action: 'create-booking', tenantId,
          serviceId:   selectedService.id,
          staffId:     selectedStaff?.id || null,
          bookingDate: format(selectedDate, 'yyyy-MM-dd'),
          startTime:   selectedTime,
          clientName:  clientName.trim(),
          clientPhone: clientPhone.replace(/\s/g, ''),
          clientEmail: clientEmail.trim() || undefined,
        },
      });

      // Extract the booking ID from any response shape the edge function might return
      // (supports both current format {bookingId} and legacy {booking:{id}})
      const d = response.data;
      const bookingId = d?.bookingId || d?.booking?.id || null;

      // Application-level error in response body (returned with 4xx/5xx)
      const appError = d?.error || null;

      // SDK-level error (non-2xx returned and SDK caught it)
      if (response.error && !bookingId) {
        // Try to surface the actual message from response body first
        throw new Error(appError || response.error.message || 'Booking service unavailable');
      }

      if (appError && !bookingId) throw new Error(appError);

      if (d?.requiresPayment && d?.paymentUrl) {
        window.location.href = d.paymentUrl;
        return;
      }

      if (!bookingId) {
        // Log full response to console for debugging
        console.error('[booking] unexpected response:', JSON.stringify(d));
        throw new Error('Booking could not be saved — please try again or call us directly');
      }

      setBookingRef(bookingId.slice(-6).toUpperCase());
      setPortalToken(d?.portalToken || '');
      setIsNewClient(d?.isNewClient ?? false);
      setStep('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Please try again.';
      toast({ title: ar ? 'فشل الحجز' : 'Booking Failed', description: msg, variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const categories = ['all', ...Array.from(new Set(services.map(s => s.category)))];
  const filteredServices = selectedCategory === 'all'
    ? services
    : services.filter(s => s.category === selectedCategory);

  const stepConfig = [
    { id: 'phone',    label: ar ? 'هويتك'   : 'You',      icon: Phone },
    { id: 'service',  label: ar ? 'الخدمة'  : 'Service',  icon: Scissors },
    { id: 'datetime', label: ar ? 'الموعد'  : 'Time',     icon: CalendarIcon },
    { id: 'details',  label: ar ? 'تأكيد'   : 'Confirm',  icon: CheckCircle2 },
  ];
  const currentStepIdx = stepConfig.findIndex(s => s.id === step);

  // ── No tenant ──────────────────────────────────────────────
  if (!tenantId) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-sm">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Scissors className="h-8 w-8 text-primary"/>
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>Online Booking</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Use the booking link provided by your salon. It looks like:
          <code className="block bg-muted px-2 py-1 rounded text-xs mt-2">/book?tenant=SALON_ID</code>
        </p>
        <Link to="/"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4"/>Back to Home</Button></Link>
      </div>
    </div>
  );

  // ── Success screen ─────────────────────────────────────────
  if (step === 'success') {
    const portalUrl = portalToken
      ? `${window.location.origin}/my?tenant=${tenantId}&token=${portalToken}`
      : null;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-5" dir={ar ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-sm space-y-4">

          {/* Celebration */}
          <div className="text-center pt-4">
            <div className="relative mx-auto mb-4 w-fit">
              <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Clock className="h-10 w-10 text-amber-500"/>
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-primary animate-pulse"/>
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              {ar ? 'تم استلام طلبك! 🎉' : 'Request Received! 🎉'}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {ar
                ? 'سيتم مراجعة طلبك وتأكيده قريباً. ستتلقين رسالة واتساب بالتأكيد.'
                : 'Your request is being reviewed. You\'ll receive a WhatsApp confirmation shortly.'}
            </p>
          </div>

          {/* Booking card */}
          <div className="bg-muted/50 rounded-2xl p-5" dir="ltr">
            <p className="text-xs text-muted-foreground mb-1">Booking Reference</p>
            <p className="text-3xl font-black tracking-widest text-primary stat-number">#{bookingRef}</p>
            {selectedService && selectedDate && selectedTime && (
              <div className="mt-3 space-y-1 text-sm text-muted-foreground border-t border-border/40 pt-3">
                <p className="flex items-center gap-2"><Scissors className="h-3.5 w-3.5"/>{selectedService.name}</p>
                <p className="flex items-center gap-2"><CalendarIcon className="h-3.5 w-3.5"/>{format(selectedDate, 'EEEE, MMM d, yyyy')}</p>
                <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5"/>{selectedTime}</p>
                {selectedStaff && <p className="flex items-center gap-2"><User className="h-3.5 w-3.5"/>{selectedStaff.name}</p>}
              </div>
            )}
          </div>

          {/* Portal CTA — meaningfully different for new vs returning */}
          {portalUrl && (
            <div className={cn(
              'rounded-2xl p-4 border space-y-3',
              isNewClient
                ? 'bg-primary/5 border-primary/20'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
            )}>
              {isNewClient ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Zap className="h-4 w-4 text-primary"/>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{ar ? 'أكملي ملفك الشخصي 🌟' : 'Complete your profile 🌟'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ar
                          ? 'احصلي على نقاط الولاء، تتبعي مواعيدك، واستلمي عروض حصرية في كل زيارة.'
                          : 'Earn loyalty points, track your appointments, and unlock exclusive offers every visit.'}
                      </p>
                    </div>
                  </div>
                  {/* Benefits list */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { emoji: '⭐', label: ar ? 'نقاط الولاء' : 'Loyalty Points' },
                      { emoji: '📅', label: ar ? 'مواعيدك' : 'Your Bookings' },
                      { emoji: '🎁', label: ar ? 'عروض خاصة' : 'Special Offers' },
                    ].map(b => (
                      <div key={b.label} className="bg-background/60 rounded-xl p-2">
                        <p className="text-base">{b.emoji}</p>
                        <p className="text-[9px] text-muted-foreground font-medium mt-0.5">{b.label}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-400"/>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {ar
                          ? `لديكِ ${foundClient?.loyaltyPoints || 0} نقطة ولاء 🎁`
                          : `You have ${foundClient?.loyaltyPoints || 0} loyalty points 🎁`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ar
                          ? 'شاهدي مواعيدك القادمة، تاريخ زياراتك، والعروض المتاحة.'
                          : 'View your upcoming appointments, visit history, and available offers.'}
                      </p>
                    </div>
                  </div>
                  {foundClient?.activePackages && foundClient.activePackages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {foundClient.activePackages.slice(0, 2).map((p, i) => (
                        <Badge key={i} className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
                          <Gift className="h-2.5 w-2.5"/>{p.package.name} ({p.sessions_remaining} left)
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )}
              <Button
                className="w-full gap-2"
                size="sm"
                onClick={() => navigate(`/my?tenant=${tenantId}&token=${portalToken}`)}>
                {isNewClient
                  ? (ar ? 'أنشئي ملفك الشخصي ←' : 'Set Up My Profile →')
                  : (ar ? 'بوابتي الشخصية ←' : 'Open My Portal →')}
              </Button>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => {
            setStep('phone');
            setSelectedService(null); setSelectedTime(''); setSelectedStaff(null);
            setClientName(''); setClientPhone(''); setClientEmail('');
            setFoundClient(null); setPhoneInput(''); setIsNewClient(false); setShowStats(false);
          }}>
            {ar ? 'حجز موعد آخر' : 'Book Another Appointment'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Main booking flow ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-background" dir={ar ? 'rtl' : 'ltr'}>

      {/* Sticky header with step progress */}
      <header className="border-b border-border/60 bg-background/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
              <Scissors className="h-4 w-4 text-primary-foreground"/>
            </div>
            <span className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
              {ar ? 'احجزي موعدك' : 'Book Appointment'}
            </span>
          </div>
          {/* Step dots */}
          <div className="flex items-center gap-1">
            {stepConfig.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                  i < currentStepIdx  ? 'bg-primary text-primary-foreground' :
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

        {/* ══════════════════════════════════════════════════════
            STEP 0 — Phone identification
            Who are you? → look up → returning or new
        ══════════════════════════════════════════════════════ */}
        {step === 'phone' && (
          <div className="space-y-8 max-w-sm mx-auto">
            <div className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Phone className="h-8 w-8 text-primary"/>
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                {ar ? 'أهلاً! ما رقمك؟' : 'Welcome! What\'s your number?'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {ar
                  ? 'نستخدم رقم هاتفك للتعرف عليكِ وتسريع عملية الحجز'
                  : 'We use your phone number to recognise you and pre-fill your details'}
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary"/>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{ar ? 'رقم الهاتف' : 'Phone Number'}</Label>
                  <Input
                    dir="ltr"
                    type="tel"
                    inputMode="numeric"
                    placeholder="+965 9XXX XXXX"
                    value={phoneInput}
                    onFocus={() => { if (!phoneInput) setPhoneInput('+965 '); }}
                    onChange={e => setPhoneInput(formatPhoneInput(e.target.value))}
                    onKeyDown={e => e.key === 'Enter' && handlePhoneLookup()}
                    className="h-12 text-base text-center tracking-widest font-mono"
                    autoFocus
                  />
                </div>
                <Button
                  onClick={handlePhoneLookup}
                  disabled={!isValidKuwaitPhone(phoneInput) || lookingUp}
                  className="w-full h-12 text-base font-semibold gap-2">
                  {lookingUp
                    ? <><Loader2 className="h-4 w-4 animate-spin"/>{ar ? 'جارٍ البحث...' : 'Checking...'}</>
                    : <>{ar ? 'متابعة' : 'Continue'}<ChevronRight className={`h-4 w-4 ${ar ? 'rotate-180' : ''}`}/></>}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  {ar ? 'بياناتك محمية ولن تُشارك مع أي طرف ثالث' : 'Your data is private and never shared with third parties'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 1 — Service selection
            Shows personalised banner for returning / new clients
        ══════════════════════════════════════════════════════ */}
        {step === 'service' && (
          <div className="space-y-5">

            {/* ── RETURNING CLIENT BANNER ── */}
            {foundClient && (
              <div className={cn(
                'rounded-2xl border p-4 bg-gradient-to-br',
                foundClient.tier === 'vvip' ? 'from-primary/8 to-amber-500/5 border-primary/25' :
                foundClient.tier === 'vip'  ? 'from-amber-500/8 to-amber-300/5 border-amber-300/40' :
                'from-muted/60 to-muted/20 border-border'
              )}>
                {/* Top row: avatar + name + points */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar with tier ring */}
                    <div className={cn(
                      'h-11 w-11 rounded-full flex items-center justify-center font-black text-sm ring-2',
                      foundClient.tier === 'vvip' ? 'bg-primary/15 text-primary ring-primary/30' :
                      foundClient.tier === 'vip'  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 ring-amber-300/50' :
                      'bg-muted text-muted-foreground ring-border'
                    )}>
                      {foundClient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">
                          {ar ? `مرحباً ${foundClient.name} 👋` : `Welcome back, ${foundClient.name} 👋`}
                        </p>
                        {foundClient.tier !== 'normal' && (
                          <Badge className={cn(
                            'text-[9px] h-4 px-1.5 rounded-full border-0',
                            foundClient.tier === 'vvip' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          )}>
                            {foundClient.tier === 'vvip' ? '👑 VVIP' : '⭐ VIP'}
                          </Badge>
                        )}
                      </div>
                      {/* Email if available */}
                      {foundClient.email && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="h-2.5 w-2.5"/>{foundClient.email}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Points badge */}
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end text-amber-500">
                      <Star className="h-4 w-4 fill-amber-400"/>
                      <span className="font-black stat-number text-base">{foundClient.loyaltyPoints}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">{ar ? 'نقطة ولاء' : 'loyalty pts'}</p>
                  </div>
                </div>

                {/* Active packages */}
                {foundClient.activePackages.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {foundClient.activePackages.map((p, i) => (
                      <Badge key={i} className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                        <Gift className="h-2.5 w-2.5"/>
                        {p.package.name} · {p.sessions_remaining} {ar ? 'جلسات باقية' : 'left'}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Expandable stats */}
                {foundClient.lastVisit && (
                  <>
                    <button
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3 hover:text-foreground transition-colors"
                      onClick={() => setShowStats(s => !s)}>
                      <History className="h-3 w-3"/>
                      {ar ? `آخر زيارة: ${foundClient.lastService}` : `Last: ${foundClient.lastService}`}
                      · {foundClient.lastVisit}
                      {showStats ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
                    </button>

                    {showStats && (
                      <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 gap-2 text-center">
                        {[
                          { val: foundClient.totalVisits,           label: ar ? 'زيارة' : 'visits',      color: 'text-primary' },
                          { val: foundClient.totalSpent.toFixed(0), label: ar ? 'KWD' : 'KWD spent',     color: 'text-emerald-600' },
                          { val: foundClient.loyaltyPoints,         label: ar ? 'نقطة' : 'points',       color: 'text-amber-600' },
                        ].map(({ val, label, color }) => (
                          <div key={label} className="bg-background/60 rounded-xl p-2">
                            <p className={cn('text-base font-black stat-number', color)}>{val}</p>
                            <p className="text-[9px] text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* "Not you?" escape */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground">
                    {ar ? 'تم ملء بياناتك تلقائياً' : 'Details pre-filled from your account'}
                  </p>
                  <button
                    onClick={resetIdentity}
                    className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-1">
                    <RefreshCw className="h-2.5 w-2.5"/>
                    {ar ? 'لستِ أنتِ؟' : 'Not you?'}
                  </button>
                </div>
              </div>
            )}

            {/* ── NEW CLIENT BANNER ── */}
            {!foundClient && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-blue-600"/>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">
                      {ar ? 'يسعدنا استقبالك لأول مرة! ✨' : 'First visit — welcome! ✨'}
                    </p>
                    <p className="text-xs text-blue-700/80 dark:text-blue-400 mt-1 leading-relaxed">
                      {ar
                        ? 'سنقوم بإنشاء ملفك الشخصي بعد الحجز. ستحصلين على نقاط ولاء مع كل زيارة وإمكانية الوصول لتاريخ مواعيدك.'
                        : 'We\'ll create your profile after booking so you can track appointments, earn loyalty points, and access exclusive offers on every visit.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── SERVICE LIST ── */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => { setStep('phone'); setFoundClient(null); setIsNewClient(false); }}
                  className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
                  <ArrowLeft className={`h-4 w-4 ${ar ? 'rotate-180' : ''}`}/>
                </button>
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {ar ? 'اختاري الخدمة' : 'Choose a Service'}
                </h2>
              </div>

              {/* Category pills */}
              {categories.length > 2 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-4">
                  {categories.map(cat => {
                    const info = CATEGORY_LABELS[cat];
                    return (
                      <button key={cat} onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border',
                          selectedCategory === cat
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                        )}>
                        {info?.emoji} {cat === 'all' ? (ar ? 'الكل' : 'All') : (ar ? info?.ar : info?.en) || cat}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Services */}
              {filteredServices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {ar ? 'لا توجد خدمات متاحة حالياً' : 'No services available right now.'}
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredServices.map(svc => {
                    const isSelected = selectedService?.id === svc.id;
                    return (
                      <button key={svc.id} onClick={() => setSelectedService(svc)}
                        className={cn(
                          'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all',
                          isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                        )}>
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                          style={{ background: svc.color ? `${svc.color}20` : 'hsl(var(--muted))' }}>
                          {CATEGORY_LABELS[svc.category]?.emoji || '✨'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{ar && svc.name_ar ? svc.name_ar : svc.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <Clock className="h-3 w-3"/>{svc.duration} {ar ? 'دقيقة' : 'min'}
                            {svc.deposit_required && (
                              <span className="flex items-center gap-0.5 text-amber-600">
                                <AlertCircle className="h-2.5 w-2.5"/>
                                {ar ? 'عربون مطلوب' : 'Deposit required'}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-primary text-sm">{svc.price.toFixed(3)}</p>
                          <p className="text-[10px] text-muted-foreground">KWD</p>
                        </div>
                        {isSelected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0"/>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Stylist picker */}
              {staff.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold mb-3">{ar ? 'اختاري الموظفة (اختياري)' : 'Choose a Stylist (optional)'}</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setSelectedStaff(null)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                        !selectedStaff ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                      )}>
                      {ar ? 'أي موظفة' : 'Any Stylist'}
                    </button>
                    {staff.map(s => (
                      <button key={s.id} onClick={() => setSelectedStaff(s)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                          selectedStaff?.id === s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                        )}>
                        {ar && s.name_ar ? s.name_ar : s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => setStep('datetime')}
                disabled={!selectedService}
                className="w-full h-12 gap-2 text-base font-semibold mt-5">
                {ar ? 'متابعة' : 'Continue'}
                <ChevronRight className={`h-4 w-4 ${ar ? 'rotate-180' : ''}`}/>
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 2 — Date & Time
        ══════════════════════════════════════════════════════ */}
        {step === 'datetime' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('service')}
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ArrowLeft className={`h-4 w-4 ${ar ? 'rotate-180' : ''}`}/>
              </button>
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {ar ? 'اختاري الموعد' : 'Pick a Date & Time'}
                </h2>
                <p className="text-xs text-muted-foreground">{selectedService?.name}</p>
              </div>
            </div>

            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={d => { setSelectedDate(d); setSelectedTime(''); }}
                disabled={d => isBefore(d, startOfDay(new Date()))}
                className="rounded-2xl border border-border p-4"
              />
            </div>

            {selectedDate && (
              <div>
                <p className="text-sm font-semibold mb-3">{ar ? 'الأوقات المتاحة' : 'Available Times'}</p>
                <div className="grid grid-cols-4 gap-2">
                  {generateTimeSlots().map(slot => (
                    <button key={slot} onClick={() => setSelectedTime(slot)}
                      className={cn(
                        'py-2.5 rounded-xl text-sm font-medium border transition-all',
                        selectedTime === slot
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:border-primary/40'
                      )}>
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={() => setStep('details')}
              disabled={!selectedDate || !selectedTime}
              className="w-full h-12 gap-2 text-base font-semibold">
              {ar ? 'متابعة' : 'Continue'}
              <ChevronRight className={`h-4 w-4 ${ar ? 'rotate-180' : ''}`}/>
            </Button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 3 — Confirm details
            Returning: read-only phone, editable name/email
            New: fill in all fields
        ══════════════════════════════════════════════════════ */}
        {step === 'details' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('datetime')}
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ArrowLeft className={`h-4 w-4 ${ar ? 'rotate-180' : ''}`}/>
              </button>
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {ar ? 'تأكيد الحجز' : 'Confirm Booking'}
                </h2>
                <p className="text-xs text-muted-foreground">{ar ? 'خطوة أخيرة!' : 'Almost done!'}</p>
              </div>
            </div>

            {/* Booking summary card */}
            <div className="bg-muted/40 rounded-2xl p-4 space-y-2.5 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {ar ? 'ملخص الحجز' : 'Booking Summary'}
              </p>
              {[
                { icon: Scissors,     label: ar ? 'الخدمة'   : 'Service',  val: selectedService?.name },
                { icon: CalendarIcon, label: ar ? 'التاريخ'  : 'Date',     val: selectedDate ? format(selectedDate, 'EEEE, MMM d, yyyy') : '' },
                { icon: Clock,        label: ar ? 'الوقت'    : 'Time',     val: selectedTime },
                { icon: User,         label: ar ? 'الموظفة'  : 'Stylist',  val: selectedStaff?.name || (ar ? 'أي موظفة' : 'Any Available') },
              ].filter(r => r.val).map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <row.icon className="h-3.5 w-3.5"/>{row.label}
                  </div>
                  <span className="font-medium">{row.val}</span>
                </div>
              ))}
              <div className="border-t border-border/50 pt-2 flex items-center justify-between font-semibold">
                <span>{ar ? 'الإجمالي' : 'Total'}</span>
                <span className="text-primary stat-number">{selectedService?.price.toFixed(3)} KWD</span>
              </div>
              {selectedService?.deposit_required && (
                <div className="flex items-center justify-between text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-xl px-3 py-2">
                  <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3"/>{ar ? 'العربون المطلوب' : 'Deposit Required'}</span>
                  <span className="font-bold">{selectedService.deposit_amount.toFixed(3)} KWD</span>
                </div>
              )}
            </div>

            {/* Pre-filled notice for returning clients */}
            {foundClient && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0"/>
                <div className="flex-1">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {ar ? 'تم ملء بياناتك من حسابك. يمكنك تعديل الاسم والبريد الإلكتروني.' : 'Details pre-filled from your account. You can edit your name and email below.'}
                  </p>
                </div>
                <button onClick={resetIdentity} className="text-[10px] text-emerald-600/70 hover:text-emerald-800 flex items-center gap-1 flex-shrink-0">
                  <RefreshCw className="h-2.5 w-2.5"/>
                  {ar ? 'تغيير' : 'Change'}
                </button>
              </div>
            )}

            {/* Form fields */}
            <div className="space-y-4">
              {/* Name — always editable */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground"/>
                  {ar ? 'الاسم الكامل *' : 'Full Name *'}
                </Label>
                <Input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder={ar ? 'اسمك الكامل' : 'Your full name'}
                  className="h-11"
                />
              </div>

              {/* Phone — readonly for returning clients, auto-formatted for new */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground"/>
                  {ar ? 'رقم الهاتف *' : 'Phone Number *'}
                  {foundClient && (
                    <span className="text-[10px] text-muted-foreground font-normal ml-1">
                      ({ar ? 'من حسابك' : 'from your account'})
                    </span>
                  )}
                </Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  dir="ltr"
                  value={clientPhone}
                  onFocus={() => { if (!foundClient && !clientPhone) setClientPhone('+965 '); }}
                  onChange={e => { if (!foundClient) setClientPhone(formatPhoneInput(e.target.value)); }}
                  placeholder="+965 9XXX XXXX"
                  className={cn('h-11 font-mono tracking-wide', foundClient && 'bg-muted/40 cursor-not-allowed text-muted-foreground')}
                  readOnly={!!foundClient}
                />
              </div>

              {/* Email — always editable, shown as "pre-filled" for returning */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground"/>
                  {ar ? 'البريد الإلكتروني' : 'Email'}
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({ar ? 'اختياري' : 'optional'})
                  </span>
                </Label>
                <Input
                  type="email"
                  dir="ltr"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="h-11"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !clientName.trim() || !clientPhone.trim()}
              className="w-full h-12 gap-2 text-base font-semibold">
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin"/>{ar ? 'جارٍ الحجز...' : 'Booking...'}</>
                : <>{selectedService?.deposit_required ? (ar ? 'ادفعي العربون واحجزي' : 'Pay Deposit & Book') : (ar ? 'تأكيد الحجز' : 'Confirm Booking')}<Sparkles className="h-4 w-4"/></>}
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
