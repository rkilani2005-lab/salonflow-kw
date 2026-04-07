import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const TRUST_POINTS = [
  { en: '14-day free trial', ar: 'تجربة مجانية 14 يوم' },
  { en: 'No credit card', ar: 'بدون بطاقة ائتمان' },
  { en: 'Cancel anytime', ar: 'إلغاء في أي وقت' },
];

const HeroSection = () => {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background grid */}
      <div className="absolute inset-0 grid-overlay opacity-40" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] animate-pulse-glow pointer-events-none" style={{ animationDelay: '1.5s' }} />

      <div className="container mx-auto px-6 relative z-10 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* ── Left: Copy ── */}
          <div className={isRTL ? 'lg:order-2' : ''}>
            <Badge variant="outline" className="mb-6 gap-1.5 px-3 py-1.5 text-xs font-semibold border-primary/30 bg-primary/8 text-primary">
              <Sparkles className="h-3 w-3" />
              {ar ? 'مدعوم بالذكاء الاصطناعي • الكويت والخليج' : 'AI-Powered • Kuwait & GCC'}
            </Badge>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-gradient">
                {ar ? 'أدِيري صالونك' : 'Run your salon'}
              </span>
              <br />
              <span className="text-foreground">
                {ar ? 'بذكاء حقيقي' : 'with real AI'}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl leading-relaxed">
              {ar
                ? 'ZAINA هو نظام إدارة الصالونات الأذكى في الكويت والخليج. حجوزات آلية، تقارير لحظية، وذكاء اصطناعي يعرف عميلاتك قبلك.'
                : 'ZAINA is the smartest salon management platform in Kuwait & GCC. Automated bookings, live analytics, and AI that knows your clients before you do.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="gap-2 px-8 h-12 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
                  {ar ? 'ابدأ مجاناً' : 'Start Free Trial'}
                  <ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                </Button>
              </Link>
              <Link to="/book?demo=true">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base font-semibold hover:bg-primary/5 hover:border-primary/40">
                  {ar ? 'شاهد العرض' : 'See Demo Booking'}
                </Button>
              </Link>
            </div>

            {/* Trust points */}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {TRUST_POINTS.map(p => (
                <div key={p.en} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  {ar ? p.ar : p.en}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Dashboard Preview ── */}
          <div className={`hidden lg:block ${isRTL ? 'lg:order-1' : ''}`}>
            <div className="relative">
              {/* Glow behind card */}
              <div className="absolute inset-0 hero-glow rounded-3xl scale-110" />

              {/* Mock dashboard card */}
              <div className="relative bg-card border border-border/60 rounded-2xl overflow-hidden shadow-2xl">
                {/* Header bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 text-center text-[11px] text-muted-foreground font-medium">ZAINA Dashboard</div>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-3 gap-3 p-4 border-b border-border/30">
                  {[
                    { label: ar ? 'إيرادات اليوم' : "Today's Revenue", value: '245.500', unit: 'KWD', color: 'text-primary' },
                    { label: ar ? 'المواعيد' : 'Appointments', value: '12', unit: ar ? 'اليوم' : 'today', color: 'text-emerald-500' },
                    { label: ar ? 'العميلات' : 'Clients', value: '156', unit: ar ? 'نشطة' : 'active', color: 'text-amber-500' },
                  ].map(k => (
                    <div key={k.label} className="bg-muted/40 rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">{k.label}</p>
                      <p className={`text-lg font-bold stat-number ${k.color}`}>{k.value}</p>
                      <p className="text-[10px] text-muted-foreground">{k.unit}</p>
                    </div>
                  ))}
                </div>

                {/* Schedule preview */}
                <div className="p-4 space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {ar ? 'الجدول اليوم' : "Today's Schedule"}
                  </p>
                  {[
                    { time: '09:00', client: ar ? 'سارة أحمد' : 'Sarah Ahmed', service: ar ? 'صبغ شعر' : 'Hair Color', status: 'done' },
                    { time: '11:00', client: ar ? 'ريم حسن' : 'Reem Hassan', service: ar ? 'قص شعر' : 'Haircut', status: 'active' },
                    { time: '13:00', client: ar ? 'ليلى خالد' : 'Layla Khalid', service: ar ? 'مانيكير' : 'Manicure', status: 'upcoming' },
                    { time: '15:30', client: ar ? 'نادية عمر' : 'Nadia Omar', service: ar ? 'فيشل' : 'Facial', status: 'upcoming' },
                  ].map(a => (
                    <div key={a.time} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors">
                      <span className="text-[11px] font-bold text-primary w-10 flex-shrink-0">{a.time}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{a.client}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.service}</p>
                      </div>
                      <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                        a.status === 'done' ? 'bg-emerald-400' :
                        a.status === 'active' ? 'bg-blue-400 animate-pulse' : 'bg-muted-foreground/30'
                      }`} />
                    </div>
                  ))}
                </div>

                {/* AI badge */}
                <div className="mx-4 mb-4 flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-xl px-3 py-2.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <p className="text-[11px] text-primary font-medium">
                    {ar ? 'ZAINA AI: لديك 3 عميلات لم يزرن منذ 30 يوم — أرسلي لهن رسالة؟' : 'ZAINA AI: 3 clients haven\'t visited in 30 days — send re-engagement?'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social proof bar */}
        <div className="mt-16 pt-10 border-t border-border/40">
          <p className="text-center text-xs text-muted-foreground mb-6 uppercase tracking-widest font-semibold">
            {ar ? 'موثوق من قبل صالونات في' : 'Trusted by salons across'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {['Kuwait 🇰🇼', 'Saudi Arabia 🇸🇦', 'UAE 🇦🇪', 'Qatar 🇶🇦', 'Bahrain 🇧🇭', 'Oman 🇴🇲'].map(country => (
              <span key={country} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{country}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
