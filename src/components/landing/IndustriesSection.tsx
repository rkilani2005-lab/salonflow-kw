import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Scissors, Sparkles, Heart, Flower2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const INDUSTRIES = [
  { id: 'hair',   icon: Scissors, en: 'Hair Salons',   ar: 'صالونات الشعر',
    quote: { en: 'AI scheduling reduced our no-shows to near zero. Our business runs smoother than ever.', ar: 'الجدولة بالذكاء الاصطناعي أنهت الغياب عن المواعيد. عملنا يسير بسلاسة أكثر من أي وقت مضى.' },
    author: 'نورة الصباح', role: { en: 'Beauty Hub Kuwait', ar: 'بيوتي هاب الكويت' } },
  { id: 'nails',  icon: Sparkles, en: 'Nail Studios',  ar: 'استوديوهات الأظافر',
    quote: { en: 'ZAINA is the easiest salon software I\'ve used in 12 years. A complete life saver.', ar: 'ZAINA أسهل برنامج صالون استخدمته منذ 12 عاماً. أنقذ حياتي.' },
    author: 'سارة المطيري', role: { en: 'Glamour Nails Kuwait', ar: 'غلامور نيلز الكويت' } },
  { id: 'beauty', icon: Heart,    en: 'Beauty Centers',ar: 'مراكز التجميل',
    quote: { en: 'Managing appointments and inventory has never been easier. The Arabic UI is perfect.', ar: 'لم تكن إدارة المواعيد والمخزون أسهل من قبل. الواجهة العربية مثالية.' },
    author: 'فاطمة الرشيد', role: { en: 'Glamour Ladies Salon', ar: 'صالون غلامور للسيدات' } },
  { id: 'spa',    icon: Flower2,  en: 'Spas & Wellness', ar: 'السبا والعافية',
    quote: { en: 'Multi-branch lets me manage all 3 locations from my phone. Highly recommend.', ar: 'الفروع المتعددة تسمح لي بإدارة 3 فروع من هاتفي. أوصي بها بشدة.' },
    author: 'ليلى العنزي', role: { en: 'Serenity Spa Kuwait', ar: 'سيرينيتي سبا الكويت' } },
];

const IndustriesSection = () => {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [active, setActive] = useState(INDUSTRIES[0]);

  return (
    <section className="py-20 bg-muted/30" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-3">{ar ? 'لكل صالون' : 'For Every Salon'}</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {ar ? 'مصمم لجميع أنواع الصالونات' : 'Built for all salon types'}
          </h2>
        </div>

        {/* Industry tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {INDUSTRIES.map(ind => {
            const Icon = ind.icon;
            return (
              <button key={ind.id} onClick={() => setActive(ind)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all',
                  active.id === ind.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                )}>
                <Icon className="h-4 w-4" />
                {ar ? ind.ar : ind.en}
              </button>
            );
          })}
        </div>

        {/* Testimonial */}
        <div className="max-w-2xl mx-auto bg-card border border-border/60 rounded-2xl p-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <active.icon className="h-8 w-8 text-primary" />
          </div>
          <blockquote className="text-lg font-medium leading-relaxed mb-6" dir={ar ? 'rtl' : 'ltr'}>
            "{ar ? active.quote.ar : active.quote.en}"
          </blockquote>
          <p className="font-semibold">{active.author}</p>
          <p className="text-sm text-muted-foreground">{ar ? active.role.ar : active.role.en}</p>
        </div>
      </div>
    </section>
  );
};

export default IndustriesSection;
