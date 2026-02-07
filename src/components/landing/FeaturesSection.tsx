import { Calendar, Users, TrendingUp, MessageSquare, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const powers = [
  {
    icon: Calendar,
    titleKey: 'powers.booking.title',
    descKey: 'powers.booking.desc',
    gradient: 'from-primary to-primary/60',
  },
  {
    icon: Users,
    titleKey: 'powers.clients.title',
    descKey: 'powers.clients.desc',
    gradient: 'from-accent to-accent/60',
  },
  {
    icon: TrendingUp,
    titleKey: 'powers.analytics.title',
    descKey: 'powers.analytics.desc',
    gradient: 'from-primary to-accent',
  },
  {
    icon: MessageSquare,
    titleKey: 'powers.marketing.title',
    descKey: 'powers.marketing.desc',
    gradient: 'from-accent to-primary',
  },
];

const FeaturesSection = () => {
  const { t, isRTL } = useLanguage();
  
  return (
    <section id="features" className="py-24 relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 grid-overlay opacity-30" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">{t('powers.title')}</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            {t('powers.subtitle')}
          </p>
        </div>
        
        {/* Power Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {powers.map((power, index) => {
            const Icon = power.icon;
            
            return (
              <div 
                key={power.titleKey}
                className="group relative bg-card border border-border rounded-lg p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative z-10">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${power.gradient} flex items-center justify-center mb-6`}>
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  
                  {/* Title */}
                  <h3 className="font-display text-xl font-bold mb-3 text-foreground">
                    {t(power.titleKey)}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed">
                    {t(power.descKey)}
                  </p>
                </div>
                
                {/* Corner accent */}
                <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-0 w-20 h-20 overflow-hidden rounded-lg`}>
                  <div className={`absolute ${isRTL ? '-left-10' : '-right-10'} -top-10 w-20 h-20 bg-gradient-to-br ${power.gradient} opacity-10 rotate-45`} />
                </div>
              </div>
            );
          })}
        </div>
        
        {/* CTA */}
        <div className="text-center mt-12">
          <Link to="/auth?mode=signup">
            <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-medium">
              See All Features
              <ArrowRight className={`w-4 h-4 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
