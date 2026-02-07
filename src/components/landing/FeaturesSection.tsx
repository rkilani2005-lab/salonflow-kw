import { Clock, Settings, Users, BarChart3, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: Clock,
    titleKey: 'features.time.title',
    descKey: 'features.time.desc',
    items: ['features.time.item1', 'features.time.item2', 'features.time.item3'],
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: Settings,
    titleKey: 'features.manage.title',
    descKey: 'features.manage.desc',
    items: ['features.manage.item1', 'features.manage.item2', 'features.manage.item3'],
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    icon: Users,
    titleKey: 'features.customers.title',
    descKey: 'features.customers.desc',
    items: ['features.customers.item1', 'features.customers.item2', 'features.customers.item3'],
    color: 'bg-green-500/10 text-green-500',
  },
  {
    icon: BarChart3,
    titleKey: 'features.success.title',
    descKey: 'features.success.desc',
    items: ['features.success.item1', 'features.success.item2', 'features.success.item3'],
    color: 'bg-purple-500/10 text-purple-500',
  },
];

const FeaturesSection = () => {
  const { t, isRTL } = useLanguage();
  
  return (
    <section id="features" className="py-20">
      <div className="container mx-auto px-4">
        {/* Tagline */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-20 max-w-4xl mx-auto">
          {t('features.tagline')}
        </h2>
        
        {/* Feature blocks - alternating layout */}
        <div className="space-y-24">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isReversed = index % 2 === 1;
            
            return (
              <div 
                key={feature.titleKey}
                className={`grid lg:grid-cols-2 gap-12 items-center ${
                  (isReversed && !isRTL) || (!isReversed && isRTL) ? 'lg:flex-row-reverse' : ''
                }`}
              >
                {/* Content */}
                <div className={`${(isReversed && !isRTL) || (!isReversed && isRTL) ? 'lg:order-2' : ''}`}>
                  <div className={`w-16 h-16 rounded-2xl ${feature.color} flex items-center justify-center mb-6`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  
                  <h3 className="text-2xl md:text-3xl font-bold text-primary mb-4">
                    {t(feature.titleKey)}
                  </h3>
                  
                  <p className="text-lg text-muted-foreground mb-6">
                    {t(feature.descKey)}
                  </p>
                  
                  <ul className="space-y-3 mb-8">
                    {feature.items.map((itemKey) => (
                      <li key={itemKey} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-primary" />
                        </div>
                        <span>{t(itemKey)}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link to="/auth?mode=signup">
                    <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                      {t('hero.demo')}
                    </Button>
                  </Link>
                </div>
                
                {/* Visual placeholder */}
                <div className={`${(isReversed && !isRTL) || (!isReversed && isRTL) ? 'lg:order-1' : ''}`}>
                  <div className="relative">
                    <div className="aspect-[4/3] rounded-2xl bg-muted flex items-center justify-center">
                      <Icon className="w-24 h-24 text-muted-foreground/30" />
                    </div>
                    {/* Decorative elements */}
                    <div className={`absolute -top-4 ${isRTL ? '-left-4' : '-right-4'} w-24 h-24 rounded-full bg-primary/5`} />
                    <div className={`absolute -bottom-4 ${isRTL ? '-right-4' : '-left-4'} w-16 h-16 rounded-full bg-primary/10`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
