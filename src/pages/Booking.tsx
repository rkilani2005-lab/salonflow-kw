import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, CheckCircle2, Scissors, ChevronRight, User, Sparkles, Calendar as CalendarIcon, Phone, Mail, ArrowLeft } from 'lucide-react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface Service { id: string; name: string; name_ar: string | null; category: string; duration: number; price: number; deposit_required: boolean; deposit_amount: number; color: string; }
interface Staff { id: string; name: string; name_ar: string | null; color: string; working_hours_start: string; working_hours_end: string; }
type Step = 'service' | 'datetime' | 'details' | 'success';

const CATEGORY_LABELS: Record<string, { en: string; ar: string; emoji: string }> = {
  hair:    { en: 'Hair',    ar: 'شعر',       emoji: '✂️' },
  nails:   { en: 'Nails',   ar: 'أظافر',     emoji: '💅' },
  facial:  { en: 'Facial',  ar: 'بشرة',      emoji: '🧖‍♀️' },
  makeup:  { en: 'Makeup',  ar: 'مكياج',     emoji: '💄' },
  waxing:  { en: 'Waxing',  ar: 'إزالة شعر', emoji: '🪒' },
  massage: { en: 'Massage', ar: 'مساج',      emoji: '💆‍♀️' },
  other:   { en: 'Other',   ar: 'أخرى',      emoji: '✨' },
};

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const tenantId = searchParams.get('tenant');
  const lang = searchParams.get('lang') === 'ar' ? 'ar' : 'en';
  const ar = lang === 'ar';

  const [step, setStep] = useState<Step>('service');
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [bookingRef, setBookingRef] = useState('');

  useEffect(() => {
    if (tenantId) { loadData(); }
    else { setLoading(false); }
  }, [tenantId]);

  useEffect(() => {
    const bookingId = searchParams.get('booking');
    if (bookingId && window.location.pathname.includes('success')) {
      setStep('success');
      setBookingRef(bookingId.slice(-6).toUpperCase());
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      const [sRes, stRes] = await Promise.all([
        supabase.functions.invoke('create-public-booking', { body: { action: 'get-services', tenantId } }),
        supabase.functions.invoke('create-public-booking', { body: { action: 'get-staff', tenantId } }),
      ]);
      if (sRes.data?.services) setServices(sRes.data.services);
      if (stRes.data?.staff) setStaff(stRes.data.staff);
    } catch { /* fail silently, show empty state */ }
    finally { setLoading(false); }
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
      toast({ title: ar ? 'معلومات ناقصة' : 'Missing Information', description: ar ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('create-public-booking', {
        body: { action: 'create-booking', tenantId, serviceId: selectedService.id, staffId: selectedStaff?.id || null,
          bookingDate: format(selectedDate, 'yyyy-MM-dd'), startTime: selectedTime,
          clientName: clientName.trim(), clientPhone: clientPhone.replace(/\s/g,''), clientEmail: clientEmail || undefined },
      });
      if (response.data?.error) throw new Error(response.data.error);
      if (response.data?.requiresPayment && response.data?.paymentUrl) { window.location.href = response.data.paymentUrl; return; }
      setBookingRef(response.data?.bookingId?.slice(-6).toUpperCase() || 'ZAINA');
      setStep('success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Please try again.';
      toast({ title: ar ? 'فشل الحجز' : 'Booking Failed', description: msg, variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const categories = ['all', ...Array.from(new Set(services.map(s => s.category)))];
  const filteredServices = selectedCategory === 'all' ? services : services.filter(s => s.category === selectedCategory);

  // ── No tenant ──
  if (!tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Scissors className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>Online Booking</h1>
          <p className="text-muted-foreground mb-6">Please use the booking link provided by your salon. It looks like: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/book?tenant=SALON_ID</code></p>
          <Link to="/"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" />Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6" dir={ar ? 'rtl' : 'ltr'}>
        <div className="text-center max-w-md">
          <div className="relative mx-auto mb-6 w-fit">
            <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-amber-500 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            {ar ? 'تم الحجز بنجاح! 🎉' : 'Booking Confirmed! 🎉'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {ar ? 'سنرسل لك تأكيداً عبر واتساب قريباً.' : "We'll send a WhatsApp confirmation shortly."}
          </p>
          {bookingRef && (
            <div className="bg-muted rounded-2xl p-5 mb-6 text-left" dir="ltr">
              <p className="text-xs text-muted-foreground mb-1">{ar ? 'رقم الحجز' : 'Booking Reference'}</p>
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
          )}
          <Button onClick={() => { setStep('service'); setSelectedService(null); setSelectedTime(''); setClientName(''); setClientPhone(''); setClientEmail(''); }} className="gap-2">
            {ar ? 'حجز موعد آخر' : 'Book Another Appointment'}
          </Button>
        </div>
      </div>
    );
  }

  const stepConfig = [
    { id: 'service',  label: ar ? 'الخدمة' : 'Service',  icon: Scissors },
    { id: 'datetime', label: ar ? 'الموعد' : 'Date/Time', icon: CalendarIcon },
    { id: 'details',  label: ar ? 'بياناتك' : 'Details',  icon: User },
  ];
  const currentStepIdx = stepConfig.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-background" dir={ar ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b border-border/60 bg-background/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
              <Scissors className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
              {ar ? 'احجزي موعدك' : 'Book Appointment'}
            </span>
          </div>
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
                {i < stepConfig.length - 1 && <div className={cn('h-px w-4', i < currentStepIdx ? 'bg-primary' : 'bg-muted')} />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* ── Step 1: Service ── */}
        {step === 'service' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                {ar ? 'اختاري الخدمة' : 'Choose a Service'}
              </h2>
              <p className="text-sm text-muted-foreground">{ar ? 'ما الذي تودين الحصول عليه اليوم؟' : 'What would you like today?'}</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <>
                {/* Category filter */}
                {categories.length > 2 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
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

                {/* Service grid */}
                {filteredServices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    {ar ? 'لا توجد خدمات متاحة' : 'No services available. Please check back later.'}
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
                          <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: svc.color ? `${svc.color}20` : 'hsl(var(--muted))' }}>
                            {CATEGORY_LABELS[svc.category]?.emoji || '✨'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{ar && svc.name_ar ? svc.name_ar : svc.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />{svc.duration} {ar ? 'دقيقة' : 'min'}
                              {svc.deposit_required && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 ml-1 rounded-full">
                                  {ar ? 'عربون مطلوب' : 'Deposit req.'}
                                </Badge>
                              )}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-primary">{svc.price.toFixed(3)}</p>
                            <p className="text-[10px] text-muted-foreground">KWD</p>
                          </div>
                          {isSelected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Staff picker */}
                {staff.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3">{ar ? 'اختاري الموظفة (اختياري)' : 'Choose a Stylist (optional)'}</p>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setSelectedStaff(null)}
                        className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                          !selectedStaff ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                        )}>
                        {ar ? 'أي موظفة' : 'Any Stylist'}
                      </button>
                      {staff.map(s => (
                        <button key={s.id} onClick={() => setSelectedStaff(s)}
                          className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                            selectedStaff?.id === s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                          )}>
                          {ar && s.name_ar ? s.name_ar : s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={() => setStep('datetime')} disabled={!selectedService} className="w-full h-12 gap-2 text-base font-semibold">
                  {ar ? 'متابعة' : 'Continue'}
                  <ChevronRight className={`h-4 w-4 ${ar ? 'rotate-180' : ''}`} />
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Date & Time ── */}
        {step === 'datetime' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('service')} className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ArrowLeft className={`h-4 w-4 ${ar ? 'rotate-180' : ''}`} />
              </button>
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>{ar ? 'اختاري الموعد' : 'Pick a Date & Time'}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedService ? (ar && selectedService.name_ar ? selectedService.name_ar : selectedService.name) : ''}</p>
              </div>
            </div>

            {/* Calendar */}
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={d => { setSelectedDate(d); setSelectedTime(''); }}
                disabled={d => isBefore(d, startOfDay(new Date()))}
                className="rounded-2xl border border-border p-4"
              />
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div>
                <p className="text-sm font-semibold mb-3">{ar ? 'اختاري الوقت' : 'Available Times'}</p>
                <div className="grid grid-cols-4 gap-2">
                  {generateTimeSlots().map(slot => (
                    <button key={slot} onClick={() => setSelectedTime(slot)}
                      className={cn(
                        'py-2 rounded-xl text-sm font-medium border transition-all',
                        selectedTime === slot
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:border-primary/40'
                      )}>
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={() => setStep('details')} disabled={!selectedDate || !selectedTime} className="w-full h-12 gap-2 text-base font-semibold">
              {ar ? 'متابعة' : 'Continue'}
              <ChevronRight className={`h-4 w-4 ${ar ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        )}

        {/* ── Step 3: Details ── */}
        {step === 'details' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('datetime')} className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ArrowLeft className={`h-4 w-4 ${ar ? 'rotate-180' : ''}`} />
              </button>
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>{ar ? 'بياناتك' : 'Your Details'}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{ar ? 'خطوة أخيرة!' : 'Almost done!'}</p>
              </div>
            </div>

            {/* Booking summary */}
            <div className="bg-muted/40 rounded-2xl p-4 space-y-2 text-sm">
              <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-3">{ar ? 'ملخص الحجز' : 'Booking Summary'}</p>
              {[
                { icon: Scissors,     label: ar ? 'الخدمة' : 'Service',  val: selectedService ? (ar && selectedService.name_ar ? selectedService.name_ar : selectedService.name) : '' },
                { icon: CalendarIcon, label: ar ? 'التاريخ' : 'Date',    val: selectedDate ? format(selectedDate, 'EEEE, MMM d, yyyy') : '' },
                { icon: Clock,        label: ar ? 'الوقت' : 'Time',      val: selectedTime },
                { icon: User,         label: ar ? 'الموظفة' : 'Stylist', val: selectedStaff ? (ar && selectedStaff.name_ar ? selectedStaff.name_ar : selectedStaff.name) : (ar ? 'أي موظفة' : 'Any Available') },
              ].map(row => row.val && (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <row.icon className="h-3.5 w-3.5" />{row.label}
                  </div>
                  <span className="font-medium">{row.val}</span>
                </div>
              ))}
              <div className="border-t border-border/60 pt-2 flex items-center justify-between font-semibold">
                <span>{ar ? 'الإجمالي' : 'Total'}</span>
                <span className="text-primary">{selectedService?.price.toFixed(3)} KWD</span>
              </div>
              {selectedService?.deposit_required && (
                <div className="flex items-center justify-between text-amber-600 text-xs">
                  <span>{ar ? 'العربون المطلوب' : 'Deposit Required'}</span>
                  <span>{selectedService.deposit_amount.toFixed(3)} KWD</span>
                </div>
              )}
            </div>

            {/* Form fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />{ar ? 'الاسم الكامل *' : 'Full Name *'}
                </Label>
                <Input placeholder={ar ? 'اسمك الكامل' : 'Your full name'} value={clientName} onChange={e => setClientName(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />{ar ? 'رقم الهاتف *' : 'Phone Number *'}
                </Label>
                <Input placeholder="+965 9XXX XXXX" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="h-11" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />{ar ? 'البريد الإلكتروني (اختياري)' : 'Email (optional)'}
                </Label>
                <Input type="email" placeholder="you@email.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="h-11" dir="ltr" />
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={submitting || !clientName.trim() || !clientPhone.trim()} className="w-full h-12 gap-2 text-base font-semibold">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{ar ? 'جارٍ الحجز...' : 'Booking...'}</>
              ) : (
                <>{selectedService?.deposit_required ? (ar ? 'ادفعي العربون واحجزي' : 'Pay Deposit & Book') : (ar ? 'تأكيد الحجز' : 'Confirm Booking')}<Sparkles className="h-4 w-4" /></>
              )}
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
