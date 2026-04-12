import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, Sparkles, Crown, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const PLANS = [
  {
    id: 'starter', icon: Sparkles, price: 15,
    name: { en: 'Starter', ar: 'المبتدئ' },
    desc: { en: 'For solo stylists & small salons', ar: 'للمستقلين والصالونات الصغيرة' },
    color: 'border-border',
    features: {
      en: ['1 branch','Up to 3 staff','Bookings & calendar','Client management','Basic POS','WhatsApp reminders'],
      ar: ['فرع واحد','حتى 3 موظفات','حجوزات وتقويم','إدارة العميلات','نقطة بيع أساسية','تذكيرات واتساب'],
    },
    notIncluded: { en: ['Multiple branches','Inventory','Advanced reports','AI features'], ar: ['فروع متعددة','مخزون','تقارير متقدمة','ميزات AI'] },
  },
  {
    id: 'professional', icon: Crown, price: 35, popular: true,
    name: { en: 'Professional', ar: 'المحترف' },
    desc: { en: 'For growing salons with teams', ar: 'للصالونات النامية مع فرق عمل' },
    color: 'border-primary',
    features: {
      en: ['Up to 3 branches','Unlimited staff','Full POS & inventory','Staff commissions','Advanced analytics','Online booking page','Priority support'],
      ar: ['حتى 3 فروع','موظفات غير محدودات','نقطة بيع ومخزون كامل','عمولات الموظفات','تحليلات متقدمة','صفحة حجز أونلاين','دعم ذو أولوية'],
    },
    notIncluded: { en: ['AI features'], ar: ['ميزات AI'] },
  },
  {
    id: 'ai', icon: Zap, price: 75,
    name: { en: 'AI Premium', ar: 'AI الأقصى' },
    desc: { en: 'Full AI power for ambitious salons', ar: 'قوة AI الكاملة للصالونات الطموحة' },
    color: 'border-accent/60',
    features: {
      en: ['Unlimited branches','Everything in Professional','WhatsApp AI Agent','Smart Scheduling AI','Client Intelligence AI','AI Inventory Assistant','Revenue Forecasting','24/7 dedicated support'],
      ar: ['فروع غير محدودة','كل ما في المحترف','وكيل واتساب AI','جدولة ذكية AI','ذكاء العميلات AI','مساعد مخزون AI','توقع الإيرادات','دعم 24/7 مخصص'],
    },
    notIncluded: { en: [], ar: [] },
  },
];

const Subscription = () => {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const currentPlan = tenant?.subscription_plan || 'starter';
  const isTrialActive = tenant?.is_trial && tenant?.trial_ends_at && new Date(tenant.trial_ends_at) > new Date();
  const trialDaysLeft = tenant?.trial_ends_at ? Math.max(0, differenceInDays(new Date(tenant.trial_ends_at), new Date())) : 0;
  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;

  const planLevel = (id: string) => ({ starter: 1, professional: 2, ai: 3 }[id] || 0);
  const canUpgrade = (id: string) => planLevel(id) > planLevel(currentPlan);

  const handleUpgrade = (planId: string) => {
    toast({ title: `Upgrading to ${planId}`, description: 'Payment integration coming soon. Contact support@zaina.ai to upgrade manually.' });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">{ar ? 'الاشتراك' : 'Subscription'}</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {ar ? 'خطتك الحالية' : 'Your Plan'}
          </h1>
        </div>
      </div>

      {/* Trial / Current plan banner */}
      {isTrialActive ? (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">
                {ar ? `تجربتك المجانية تنتهي خلال ${trialDaysLeft} يوم` : `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''}`}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {ar
                  ? `اختاري خطة للاستمرار في استخدام ZAINA بعد ${trialEndsAt ? format(trialEndsAt, 'MMM d, yyyy') : ''}`
                  : `Choose a plan to continue after ${trialEndsAt ? format(trialEndsAt, 'MMMM d, yyyy') : ''}`}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-200 text-sm">
                {ar ? `أنت على خطة ${currentPlan}` : `You're on the ${currentPlan} plan`}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                {ar ? 'اشتراكك نشط. شكراً لاستخدامك ZAINA!' : 'Your subscription is active. Thank you for using ZAINA!'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map(plan => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.id;
          const upgradable = canUpgrade(plan.id);
          const features = ar ? plan.features.ar : plan.features.en;
          const notIncluded = ar ? plan.notIncluded.ar : plan.notIncluded.en;

          return (
            <div key={plan.id} className={cn(
              'relative rounded-2xl border-2 p-5 flex flex-col transition-all duration-200 bg-card',
              isCurrent ? 'border-primary shadow-md shadow-primary/10' :
              plan.popular && upgradable ? `${plan.color} hover:border-primary/60` :
              `${plan.color} hover:border-primary/30`
            )}>
              {plan.popular && upgradable && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="px-3 py-1 text-[11px] font-bold bg-primary text-primary-foreground">
                    {ar ? 'الأكثر شعبية' : 'Most Popular'}
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="px-3 py-1 text-[11px] font-bold bg-emerald-500 text-white">
                    {ar ? 'خطتك الحالية' : 'Current Plan'}
                  </Badge>
                </div>
              )}

              <div className="mb-4">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center mb-3',
                  isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="font-bold text-base" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                  {ar ? plan.name.ar : plan.name.en}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{ar ? plan.desc.ar : plan.desc.en}</p>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold stat-number">{plan.price}</span>
                <span className="text-muted-foreground text-sm ml-1">{currency}/mo</span>
              </div>

              <div className="space-y-1.5 flex-1 mb-5">
                {features.map(f => (
                  <div key={f} className="flex items-start gap-2 text-xs">
                    <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </div>
                ))}
                {notIncluded.map(f => (
                  <div key={f} className="flex items-start gap-2 text-xs opacity-40">
                    <X className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground line-through">{f}</span>
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <Button variant="outline" disabled className="w-full text-xs h-9">
                  {ar ? '✓ خطتك الحالية' : '✓ Current Plan'}
                </Button>
              ) : upgradable ? (
                <Button onClick={() => handleUpgrade(plan.id)} className="w-full text-xs h-9 gap-1.5">
                  {ar ? `ترقية إلى ${plan.name.ar}` : `Upgrade to ${plan.name.en}`}
                  <Zap className="h-3 w-3" />
                </Button>
              ) : (
                <Button variant="outline" disabled className="w-full text-xs h-9 opacity-40">
                  {ar ? 'خطة سابقة' : 'Lower plan'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <Card className="border">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-bold text-sm" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {ar ? 'أسئلة شائعة' : 'Frequently Asked Questions'}
          </h3>
          {[
            { q: { en: 'Can I cancel anytime?', ar: 'هل يمكنني الإلغاء في أي وقت؟' }, a: { en: 'Yes. Cancel anytime, no questions asked. You keep access until the end of your billing period.', ar: 'نعم. ألغي في أي وقت بدون أسئلة. تحتفظين بالوصول حتى نهاية فترة الفوترة.' } },
            { q: { en: 'How does the 14-day trial work?', ar: 'كيف تعمل التجربة المجانية 14 يوم؟' }, a: { en: 'Full access to all features for 14 days. No credit card required. Upgrade to a paid plan before trial ends to continue.', ar: 'وصول كامل لجميع الميزات لمدة 14 يوماً. لا تحتاجين بطاقة ائتمان. قومي بالترقية قبل انتهاء التجربة للاستمرار.' } },
            { q: { en: 'What payment methods are accepted?', ar: 'ما طرق الدفع المقبولة؟' }, a: { en: 'KNET, Visa, Mastercard. All payments in KWD for Kuwait accounts.', ar: 'كي نت، فيزا، ماستركارد. جميع المدفوعات بالدينار الكويتي للحسابات الكويتية.' } },
          ].map(item => (
            <div key={item.q.en} className="py-2 border-t border-border/50 first:border-0 first:pt-0">
              <p className="text-xs font-semibold mb-1">{ar ? item.q.ar : item.q.en}</p>
              <p className="text-xs text-muted-foreground">{ar ? item.a.ar : item.a.en}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Subscription;
