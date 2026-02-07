import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const CTASection = () => {
  const { t, isRTL } = useLanguage();
  
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="relative rounded-2xl overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent" />
          
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                               linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }}
          />
          
          {/* Glowing orbs */}
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-accent/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-primary-foreground/10 rounded-full blur-2xl" />
          
          <div className="relative py-20 px-8 md:px-16 text-center text-primary-foreground">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm rounded-md px-3 py-1.5 mb-8">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">AI-Powered</span>
            </div>
            
            {/* Headline */}
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-2">
              {t('cta.title')}
            </h2>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-primary-foreground/90">
              {t('cta.title2')}
            </h2>
            
            <p className="text-lg text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
              {t('cta.subtitle')}
            </p>
            
            {/* CTA Button */}
            <Link to="/auth?mode=signup">
              <Button 
                size="lg" 
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 text-lg px-10 h-14 font-medium"
              >
                {t('hero.cta')}
                <ArrowRight className={`w-5 h-5 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
              </Button>
            </Link>
            
            <p className="text-sm text-primary-foreground/60 mt-6">
              {t('cta.nolimit')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
