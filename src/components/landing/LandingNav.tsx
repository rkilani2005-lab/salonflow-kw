import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Globe, Zap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const LandingNav = () => {
  const { t, language, setLanguage } = useLanguage();
  
  return (
    <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary transition-all group-hover:scale-105">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">ZAINA</span>
        </Link>
        
        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
            {t('nav.features')}
          </a>
          <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
            {t('nav.pricing')}
          </a>
          <a href="#resources" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
            {t('nav.resources')}
          </a>
          <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
            {t('nav.testimonials')}
          </a>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Globe className="w-4 h-4" />
            {language === 'en' ? 'عربي' : 'EN'}
          </Button>
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="font-medium">
              {t('nav.signin')}
            </Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button size="sm" className="font-medium bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity">
              {t('nav.trial')}
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default LandingNav;
