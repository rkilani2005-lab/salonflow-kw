import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Globe, Scissors } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const LandingNav = () => {
  const { language, setLanguage, isRTL } = useLanguage();
  const ar = language === 'ar';

  return (
    <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
            <Scissors className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>ZAINA</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-7">
          {[
            { href: '#features', en: 'Features',     ar: 'المميزات' },
            { href: '#pricing',  en: 'Pricing',      ar: 'الأسعار' },
            { href: '#resources',en: 'Resources',    ar: 'الموارد' },
            { href: '#testimonials', en: 'Reviews',  ar: 'آراء العملاء' },
          ].map(link => (
            <a key={link.href} href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {ar ? link.ar : link.en}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLanguage(ar ? 'en' : 'ar')}
            className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2.5">
            <Globe className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">{ar ? 'EN' : 'عربي'}</span>
          </Button>
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">
              {ar ? 'تسجيل الدخول' : 'Sign In'}
            </Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button size="sm" className="h-8 text-xs font-semibold gap-1.5">
              {ar ? 'ابدأ مجاناً' : 'Start Free Trial'}
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default LandingNav;
