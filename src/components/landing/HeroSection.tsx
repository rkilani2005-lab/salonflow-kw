import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Brain, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const HeroSection = () => {
  const { t, isRTL } = useLanguage();
  
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      {/* Coral gradient background with diagonal */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--hero-start))] via-[hsl(var(--hero-end))] to-[hsl(25,85%,45%)]">
        {/* Diagonal overlay pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(
              ${isRTL ? '-45deg' : '45deg'},
              transparent,
              transparent 2px,
              rgba(255,255,255,0.1) 2px,
              rgba(255,255,255,0.1) 4px
            )`
          }}
        />
        {/* Decorative arrow shape */}
        <svg 
          className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-[35%] scale-x-[-1]' : 'right-[35%]'} w-48 h-48 text-white/20`}
          viewBox="0 0 100 100"
          fill="currentColor"
        >
          <path d="M30 20 L70 50 L30 80 L40 50 Z" />
        </svg>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className={`text-primary-foreground ${isRTL ? 'lg:order-2' : ''}`}>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Brain className="w-4 h-4" />
              <span className="text-sm font-medium">AI-Powered Platform</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              {t('hero.title1')}
              <br />
              <span className="text-white/90">{t('hero.title2')}</span>
            </h1>
            
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-xl">
              {t('hero.subtitle')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link to="/auth?mode=signup">
                <Button 
                  size="lg" 
                  className="bg-white text-primary hover:bg-white/90 text-lg px-8 w-full sm:w-auto"
                >
                  {t('hero.cta')}
                  <ArrowRight className={`w-5 h-5 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
                </Button>
              </Link>
              <Link to="/book">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-white/50 text-white hover:bg-white/10 text-lg px-8 w-full sm:w-auto"
                >
                  {t('hero.demo')}
                </Button>
              </Link>
            </div>
            
            <p className="text-sm text-white/70">
              ✓ {t('hero.trusted')}
            </p>
          </div>
          
          {/* Hero image placeholder - salon professional */}
          <div className={`hidden lg:block ${isRTL ? 'lg:order-1' : ''}`}>
            <div className="relative">
              <div className="aspect-[4/5] rounded-2xl bg-white/10 backdrop-blur-sm overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white/60">
                    <Sparkles className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-lg">SalonFlow Dashboard</p>
                  </div>
                </div>
              </div>
              {/* Floating stats card */}
              <div className={`absolute -bottom-4 ${isRTL ? '-right-4' : '-left-4'} bg-white rounded-xl shadow-2xl p-4`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">+40%</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Booking Increase</p>
                    <p className="text-sm text-muted-foreground">with AI optimization</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
