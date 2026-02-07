import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Brain, Network } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const HeroSection = () => {
  const { t, isRTL } = useLanguage();
  
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Grid overlay background */}
      <div className="absolute inset-0 grid-overlay opacity-50" />
      
      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div className={`${isRTL ? 'lg:order-2' : ''}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-3 py-1.5 mb-8">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
              <span className="text-sm font-medium text-primary">{t('hero.badge')}</span>
            </div>
            
            {/* Headline */}
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6">
              <span className="text-gradient">{t('hero.title1')}</span>
              <br />
              <span className="text-foreground">{t('hero.title2')}</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl leading-relaxed">
              {t('hero.subtitle')}
            </p>
            
            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link to="/auth?mode=signup">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-lg px-8 h-12 font-medium w-full sm:w-auto"
                >
                  {t('hero.cta')}
                  <ArrowRight className={`w-5 h-5 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
                </Button>
              </Link>
              <Link to="/book">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-border hover:bg-muted text-lg px-8 h-12 font-medium w-full sm:w-auto"
                >
                  {t('hero.demo')}
                </Button>
              </Link>
            </div>
            
            {/* Trust badge */}
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              {t('hero.trusted')}
            </p>
          </div>
          
          {/* Hero Visual - Abstract AI Brain */}
          <div className={`hidden lg:flex items-center justify-center ${isRTL ? 'lg:order-1' : ''}`}>
            <div className="relative">
              {/* Main visual container */}
              <div className="w-[500px] h-[500px] relative">
                {/* Rotating ring */}
                <div className="absolute inset-0 rounded-full border border-primary/20 animate-spin" style={{ animationDuration: '20s' }} />
                <div className="absolute inset-4 rounded-full border border-accent/20 animate-spin" style={{ animationDuration: '15s', animationDirection: 'reverse' }} />
                
                {/* Center brain/network icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-xl border border-primary/30 flex items-center justify-center glow-primary">
                    <Brain className="w-24 h-24 text-primary animate-float" />
                  </div>
                </div>
                
                {/* Floating elements */}
                <div className="absolute top-16 left-16 w-16 h-16 rounded-lg bg-card border border-border shadow-lg flex items-center justify-center animate-float" style={{ animationDelay: '0.5s' }}>
                  <Network className="w-8 h-8 text-accent" />
                </div>
                <div className="absolute bottom-20 right-16 w-14 h-14 rounded-lg bg-card border border-border shadow-lg flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                
                {/* Glowing dots */}
                <div className="absolute top-1/3 right-0 w-3 h-3 rounded-full bg-primary animate-pulse-glow" />
                <div className="absolute bottom-1/3 left-0 w-2 h-2 rounded-full bg-accent animate-pulse-glow" style={{ animationDelay: '0.5s' }} />
                <div className="absolute top-0 left-1/3 w-2 h-2 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
