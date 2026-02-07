import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Brain, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const plans = [
  {
    name: 'Starter',
    nameAr: 'المبتدئ',
    price: '15',
    description: 'Perfect for small salons',
    descriptionAr: 'مثالي للصالونات الصغيرة',
    features: [
      { en: 'Up to 3 staff members', ar: 'حتى 3 موظفين' },
      { en: 'Basic scheduling', ar: 'جدولة أساسية' },
      { en: 'Client management', ar: 'إدارة العملاء' },
      { en: 'Online booking page', ar: 'صفحة حجز عبر الإنترنت' },
      { en: 'Email support', ar: 'دعم البريد الإلكتروني' },
    ],
    popular: false,
    icon: Sparkles,
  },
  {
    name: 'Professional',
    nameAr: 'المحترف',
    price: '35',
    description: 'For growing salons',
    descriptionAr: 'للصالونات المتنامية',
    features: [
      { en: 'Up to 10 staff members', ar: 'حتى 10 موظفين' },
      { en: 'Advanced scheduling', ar: 'جدولة متقدمة' },
      { en: 'Full client management', ar: 'إدارة عملاء كاملة' },
      { en: 'Online payments (MyFatoorah)', ar: 'الدفع عبر الإنترنت (ماي فاتورة)' },
      { en: 'Multi-branch support', ar: 'دعم الفروع المتعددة' },
      { en: 'Priority support', ar: 'دعم ذو أولوية' },
    ],
    popular: true,
    icon: null,
  },
  {
    name: 'AI Powered',
    nameAr: 'الذكاء الاصطناعي',
    price: '75',
    description: 'Enterprise features with AI',
    descriptionAr: 'ميزات المؤسسات مع الذكاء الاصطناعي',
    features: [
      { en: 'Unlimited staff', ar: 'موظفين غير محدودين' },
      { en: 'AI appointment optimization', ar: 'تحسين المواعيد بالذكاء الاصطناعي' },
      { en: 'Predictive analytics', ar: 'تحليلات تنبؤية' },
      { en: 'Custom integrations', ar: 'تكاملات مخصصة' },
      { en: 'Dedicated account manager', ar: 'مدير حساب مخصص' },
      { en: '24/7 phone support', ar: 'دعم هاتفي على مدار الساعة' },
    ],
    popular: false,
    icon: Brain,
  },
];

const PricingSection = () => {
  const { t, language } = useLanguage();
  
  return (
    <section id="pricing" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 border-primary text-primary">
            {language === 'ar' ? 'الأسعار' : 'Pricing'}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('pricing.title')}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.name} 
              className={`relative ${plan.popular ? 'border-primary border-2 shadow-lg scale-105' : 'border-2'}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">{t('pricing.popular')}</Badge>
                </div>
              )}
              
              {plan.icon && (
                <div className="absolute top-4 right-4">
                  <plan.icon className="w-5 h-5 text-primary" />
                </div>
              )}
              
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">
                  {language === 'ar' ? plan.nameAr : plan.name}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' ? plan.descriptionAr : plan.description}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground"> {t('pricing.month')}</span>
                </div>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature.en} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm">
                        {language === 'ar' ? feature.ar : feature.en}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/auth?mode=signup">
                  <Button className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                    {t('pricing.start')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
