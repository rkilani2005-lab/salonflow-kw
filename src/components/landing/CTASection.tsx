import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const CTASection = () => {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  return (
    <section className="py-24" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent" />
          <div className="absolute inset-0 grid-overlay opacity-10" />
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="relative py-20 px-8 md:px-16 text-center text-white">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 mb-8">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-semibold">{ar ? 'مدعوم بالذكاء الاصطناعي' : 'AI-Powered Platform'}</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
              {ar ? 'توقفي عن الإدارة.' : 'Stop managing.'}
              <br />
              {ar ? 'ابدأي بالنمو.' : 'Start growing.'}
            </h2>
            <p className="text-white/80 text-lg max-w-xl mx-auto mb-10">
              {ar
                ? 'انضمي لأكثر من 500 صاحبة صالون في الكويت والخليج يستخدمن ZAINA لتنمية أعمالهن.'
                : 'Join 500+ salon owners across Kuwait & GCC using ZAINA to grow their business.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link to="/auth?mode=signup">
                <Button size="lg" variant="secondary" className="gap-2 px-8 h-12 text-base font-bold">
                  {ar ? 'ابدأي مجاناً الآن' : 'Start Free Today'}
                  <ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {[
                { en: '14-day free trial', ar: 'تجربة مجانية 14 يوم' },
                { en: 'No credit card required', ar: 'بدون بطاقة ائتمان' },
                { en: 'Cancel anytime', ar: 'إلغاء في أي وقت' },
              ].map(p => (
                <div key={p.en} className="flex items-center gap-1.5 text-sm text-white/80">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white/60" />
                  {ar ? p.ar : p.en}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default CTASection;
