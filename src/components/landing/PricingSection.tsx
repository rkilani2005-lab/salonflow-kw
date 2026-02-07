import { Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';

const plans = [
  {
    nameKey: 'pricing.starter.name',
    descKey: 'pricing.starter.desc',
    price: '15',
    features: [
      'Up to 2 staff members',
      'Basic booking system',
      'Client management',
      'SMS reminders',
      'Email support',
    ],
    featuresAr: [
      'حتى 2 موظفين',
      'نظام حجز أساسي',
      'إدارة العملاء',
      'تذكيرات SMS',
      'دعم بالبريد الإلكتروني',
    ],
  },
  {
    nameKey: 'pricing.pro.name',
    descKey: 'pricing.pro.desc',
    price: '35',
    popular: true,
    features: [
      'Up to 10 staff members',
      'Advanced scheduling',
      'Inventory management',
      'WhatsApp integration',
      'Priority support',
      'Basic analytics',
    ],
    featuresAr: [
      'حتى 10 موظفين',
      'جدولة متقدمة',
      'إدارة المخزون',
      'تكامل واتساب',
      'دعم ذو أولوية',
      'تحليلات أساسية',
    ],
  },
  {
    nameKey: 'pricing.ai.name',
    descKey: 'pricing.ai.desc',
    price: '75',
    features: [
      'Unlimited staff',
      'AI-powered predictions',
      'Smart campaigns',
      'Revenue forecasting',
      'Multi-branch support',
      '24/7 dedicated support',
    ],
    featuresAr: [
      'موظفين غير محدود',
      'توقعات مدعومة بالـ AI',
      'حملات ذكية',
      'توقع الإيرادات',
      'دعم متعدد الفروع',
      'دعم مخصص 24/7',
    ],
    gradient: true,
  },
];

const PricingSection = () => {
  const { t, language } = useLanguage();
  
  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 grid-overlay opacity-20" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">{t('pricing.title')}</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </div>
        
        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div 
              key={plan.nameKey}
              className={`relative rounded-xl p-8 transition-all hover:scale-[1.02] ${
                plan.gradient 
                  ? 'bg-gradient-to-br from-primary to-accent text-primary-foreground glow-primary' 
                  : 'bg-card border border-border hover:border-primary/30'
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-4 py-1 rounded-full text-sm font-medium">
                  {t('pricing.popular')}
                </div>
              )}
              
              {/* Plan name */}
              <div className="mb-6">
                <h3 className={`font-display text-2xl font-bold mb-1 ${plan.gradient ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {t(plan.nameKey)}
                </h3>
                <p className={plan.gradient ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                  {t(plan.descKey)}
                </p>
              </div>
              
              {/* Price */}
              <div className="mb-8">
                <span className={`text-5xl font-display font-bold ${plan.gradient ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {plan.price}
                </span>
                <span className={plan.gradient ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                  {' '}{t('pricing.month')}
                </span>
              </div>
              
              {/* Features */}
              <ul className="space-y-3 mb-8">
                {(language === 'ar' ? plan.featuresAr : plan.features).map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                      plan.gradient ? 'bg-primary-foreground/20' : 'bg-primary/10'
                    }`}>
                      <Check className={`w-3 h-3 ${plan.gradient ? 'text-primary-foreground' : 'text-primary'}`} />
                    </div>
                    <span className={plan.gradient ? 'text-primary-foreground/90' : 'text-foreground'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              
              {/* CTA */}
              <Link to="/auth?mode=signup" className="block">
                <Button 
                  className={`w-full font-medium ${
                    plan.gradient 
                      ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90' 
                      : 'bg-gradient-to-r from-primary to-accent hover:opacity-90'
                  }`}
                  size="lg"
                >
                  {plan.gradient && <Zap className="w-4 h-4 mr-2" />}
                  {t('pricing.start')}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
