import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Footer = () => {
  const { t, language } = useLanguage();
  
  return (
    <footer className="border-t py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">SalonFlow</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'منصة إدارة الصالونات الكاملة المبنية للكويت والخليج.'
                : 'The complete salon management platform built for Kuwait and the GCC.'}
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">{t('footer.product')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">{t('nav.features')}</a></li>
              <li><a href="#pricing" className="hover:text-foreground">{t('nav.pricing')}</a></li>
              <li><Link to="/book" className="hover:text-foreground">{t('footer.demo')}</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">{t('footer.company')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">{t('footer.about')}</a></li>
              <li><a href="#" className="hover:text-foreground">{t('footer.blog')}</a></li>
              <li><a href="#" className="hover:text-foreground">{t('footer.careers')}</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">{t('footer.support')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">{t('footer.help')}</a></li>
              <li><a href="#" className="hover:text-foreground">{t('footer.contact')}</a></li>
              <li><a href="#" className="hover:text-foreground">{t('footer.privacy')}</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
