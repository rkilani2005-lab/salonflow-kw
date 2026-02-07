import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const LandingNav = () => {
  const { t, language, setLanguage } = useLanguage();
  
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl">SalonFlow</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
            {t('nav.features')}
          </a>
          <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
            {t('nav.pricing')}
          </a>
          <a href="#resources" className="text-muted-foreground hover:text-foreground transition-colors">
            {t('nav.resources')}
          </a>
          <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">
            {t('nav.testimonials')}
          </a>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="gap-1"
          >
            <Globe className="w-4 h-4" />
            {language === 'en' ? 'عربي' : 'EN'}
          </Button>
          <Link to="/auth">
            <Button variant="ghost">{t('nav.signin')}</Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button className="bg-primary hover:bg-primary/90">{t('nav.trial')}</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default LandingNav;
