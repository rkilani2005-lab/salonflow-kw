import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Footer = () => {
  const { t, language } = useLanguage();
  
  return (
    <footer className="border-t border-border py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight">ZAINA</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {language === 'ar' 
                ? 'منصة إدارة الصالونات المدعومة بالذكاء الاصطناعي. صُنعت للكويت والخليج.'
                : 'The AI-powered salon intelligence platform. Built for Kuwait and the GCC.'}
            </p>
          </div>
          
          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">{t('footer.product')}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">{t('nav.features')}</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">{t('nav.pricing')}</a></li>
              <li><Link to="/book" className="hover:text-foreground transition-colors">{t('footer.demo')}</Link></li>
            </ul>
          </div>
          
          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">{t('footer.company')}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{t('footer.about')}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t('footer.blog')}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t('footer.careers')}</a></li>
            </ul>
          </div>
          
          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">{t('footer.support')}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{t('footer.help')}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t('footer.contact')}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t('footer.privacy')}</a></li>
            </ul>
          </div>
        </div>
        
        {/* Bottom bar */}
        <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground">
          {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
