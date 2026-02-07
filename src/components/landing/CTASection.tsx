import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Brain } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const CTASection = () => {
  const { t, isRTL } = useLanguage();
  
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Background with gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--hero-start))] via-[hsl(var(--hero-end))] to-[hsl(25,85%,45%)]">
            {/* Pattern overlay */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)`,
                backgroundSize: '24px 24px'
              }}
            />
          </div>
          
          <div className="relative py-16 px-8 md:px-16 text-center text-primary-foreground">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Brain className="w-4 h-4" />
              <span className="text-sm font-medium">AI-Powered</span>
            </div>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 max-w-3xl mx-auto">
              {t('cta.title')}
            </h2>
            
            <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
              {t('cta.subtitle')}
            </p>
            
            <Link to="/auth?mode=signup">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 text-lg px-8"
              >
                {t('hero.cta')}
                <ArrowRight className={`w-5 h-5 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
              </Button>
            </Link>
            
            <p className="text-sm text-white/70 mt-6">
              {t('cta.nolimit')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
