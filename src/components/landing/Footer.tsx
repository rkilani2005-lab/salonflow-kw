import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Scissors, Mail, Phone } from 'lucide-react';

const Footer = () => {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  return (
    <footer className="border-t border-border/60 py-16" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2.5 mb-4 w-fit">
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
                <Scissors className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>ZAINA</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {ar
                ? 'منصة إدارة الصالونات المدعومة بالذكاء الاصطناعي. صُنعت للكويت والخليج العربي.'
                : 'The AI-powered salon management platform. Built for Kuwait and the GCC.'}
            </p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />support@zaina.ai</div>
              <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />+965 XXXX XXXX</div>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-sm mb-4">{ar ? 'المنتج' : 'Product'}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">{ar ? 'المميزات' : 'Features'}</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">{ar ? 'الأسعار' : 'Pricing'}</a></li>
              <li><Link to="/book" className="hover:text-foreground transition-colors">{ar ? 'عرض توضيحي' : 'Demo'}</Link></li>
              <li><Link to="/auth?mode=signup" className="hover:text-foreground transition-colors">{ar ? 'ابدأ مجاناً' : 'Free Trial'}</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sm mb-4">{ar ? 'الشركة' : 'Company'}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{ar ? 'عن الشركة' : 'About'}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{ar ? 'المدونة' : 'Blog'}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{ar ? 'الوظائف' : 'Careers'}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{ar ? 'الشركاء' : 'Partners'}</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-sm mb-4">{ar ? 'الدعم' : 'Support'}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{ar ? 'مركز المساعدة' : 'Help Center'}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{ar ? 'اتصل بنا' : 'Contact Us'}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{ar ? 'سياسة الخصوصية' : 'Privacy Policy'}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{ar ? 'الشروط والأحكام' : 'Terms of Service'}</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border/50 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© 2025 ZAINA. {ar ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'} {ar ? 'صُنع بـ ⚡ في الكويت.' : 'Built with ⚡ in Kuwait.'}</p>
          <div className="flex gap-4">
            <span>🇰🇼 Kuwait</span>
            <span>🇸🇦 Saudi Arabia</span>
            <span>🇦🇪 UAE</span>
            <span>🇶🇦 Qatar</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
