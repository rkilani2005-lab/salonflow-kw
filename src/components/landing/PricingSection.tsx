import { Check, Zap, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    id: 'starter',
    icon: Sparkles,
    name: { en: 'Starter', ar: 'المبتدئ' },
    desc: { en: 'For solo stylists & small salons', ar: 'للمستقلين والصالونات الصغيرة' },
    price: 15,
    color: 'border-border',
    features: {
      en: ['1 branch', 'Up to 3 staff', 'Calendar & bookings', 'Client management', 'Basic POS', 'WhatsApp reminders'],
      ar: ['فرع واحد', 'حتى 3 موظفات', 'تقويم وحجوزات', 'إدارة العميلات', 'نقطة بيع أساسية', 'تذكيرات واتساب'],
    },
  },
  {
    id: 'professional',
    icon: Crown,
    name: { en: 'Professional', ar: 'المحترف' },
    desc: { en: 'For growing salons with teams', ar: 'للصالونات النامية مع فرق عمل' },
    price: 35,
    popular: true,
    color: 'border-primary',
    features: {
      en: ['Up to 3 branches', 'Unlimited staff', 'Full POS & inventory', 'Advanced reports', 'Staff commissions', 'Priority support', 'Online booking page'],
      ar: ['حتى 3 فروع', 'موظفات غير محدودات', 'نقطة بيع ومخزون كامل', 'تقارير متقدمة', 'عمولات الموظفات', 'دعم ذو أولوية', 'صفحة حجز عبر الإنترنت'],
    },
  },
  {
    id: 'ai',
    icon: Zap,
    name: { en: 'AI Premium', ar: 'AI الأقصى' },
    desc: { en: 'Full AI power for ambitious salons', ar: 'قوة AI الكاملة للصالونات الطموحة' },
    price: 75,
    color: 'border-accent/60',
    features: {
      en: ['Everything in Professional', 'Unlimited branches', 'WhatsApp AI agent', 'Smart scheduling AI', 'Client intelligence AI', 'AI inventory assistant', 'Revenue forecasting', '24/7 dedicated support'],
      ar: ['كل ما في المحترف', 'فروع غير محدودة', 'وكيل واتساب AI', 'جدولة ذكية AI', 'ذكاء العميلات AI', 'مساعد مخزون AI', 'توقع الإيرادات', 'دعم 24/7 مخصص'],
    },
  },
];

const PricingSection = () => {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  return (
    <section id="pricing" className="py-24" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 px-3 py-1.5 text-xs font-semibold border-primary/30 bg-primary/8 text-primary">
            {ar ? 'الأسعار' : 'Pricing'}
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
            {ar ? 'اختاري خطتك' : 'Pick your plan'}
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {ar ? 'جميع الخطط تشمل تجربة مجانية 14 يوم بدون بطاقة ائتمان' : 'All plans include a 14-day free trial. No credit card required.'}
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={cn(
                  'relative rounded-2xl border-2 p-6 flex flex-col transition-all duration-200',
                  plan.popular
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : `${plan.color} bg-card hover:border-primary/40`,
                )}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="px-3 py-1 text-[11px] font-bold bg-primary text-primary-foreground shadow-sm">
                      {ar ? 'الأكثر شعبية' : 'Most Popular'}
                    </Badge>
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <div className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center mb-4',
                    plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {ar ? plan.name.ar : plan.name.en}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{ar ? plan.desc.ar : plan.desc.en}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold stat-number">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{ar ? 'د.ك / شهر' : 'KWD / mo'}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-8 flex-1">
                  {(ar ? plan.features.ar : plan.features.en).map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <Check className={cn('h-4 w-4 mt-0.5 flex-shrink-0', plan.popular ? 'text-primary' : 'text-emerald-500')} />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link to="/auth?mode=signup">
                  <Button
                    className={cn('w-full gap-1.5', plan.popular ? '' : 'variant-outline')}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {ar ? 'ابدأ مجاناً' : 'Start Free Trial'}
                    <ArrowRight className={`h-3.5 w-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Bottom note */}
        <p className="text-center text-sm text-muted-foreground mt-10">
          {ar ? '🇰🇼 جميع الأسعار بالدينار الكويتي • يشمل ضريبة القيمة المضافة' : '🇰🇼 All prices in Kuwaiti Dinar (KWD) · Inclusive of VAT'}
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
