import { useLanguage } from '@/contexts/LanguageContext';
import { Star } from 'lucide-react';

const TESTIMONIALS = [
  { name: 'Fatima Al-Rashidi', role: { en: 'Owner, Glam Studio Kuwait City', ar: 'صاحبة، غلام ستوديو الكويت' }, avatar: 'F', color: 'bg-rose-100 text-rose-700',
    message: { en: 'ZAINA saved my business. Went from chaotic bookings to full autopilot. Revenue up 45% in 3 months. 🚀', ar: 'ZAINA أنقذت عملي. انتقلت من فوضى الحجوزات إلى الطيار الآلي. الإيرادات ارتفعت 45% في 3 أشهر. 🚀' } },
  { name: 'Nour Al-Mansouri', role: { en: 'CEO, Luxe Beauty Lounge Dubai', ar: 'مديرة، لوكس بيوتي لاونج دبي' }, avatar: 'N', color: 'bg-violet-100 text-violet-700',
    message: { en: 'The WhatsApp AI handles 80% of bookings automatically. My receptionist now focuses on clients, not admin. 💯', ar: 'وكيل واتساب AI يتعامل مع 80% من الحجوزات تلقائياً. موظفة الاستقبال تركز الآن على العميلات. 💯' } },
  { name: 'Hessa Al-Qahtani', role: { en: 'Founder, Bloom Salon Riyadh', ar: 'مؤسسة، بلوم صالون الرياض' }, avatar: 'H', color: 'bg-emerald-100 text-emerald-700',
    message: { en: 'The client intelligence feature is mind-blowing. It predicted which clients would leave before they did! 🌟', ar: 'ميزة ذكاء العميلات مذهلة. توقعت أي عميلات ستتركنا قبل أن يفعلن! 🌟' } },
];

const TestimonialsSection = () => {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  return (
    <section id="testimonials" className="py-24 bg-muted/30" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-3">{ar ? 'آراء العملاء' : 'Testimonials'}</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {ar ? 'ماذا يقول أصحاب الصالونات' : 'Salon owners love ZAINA'}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="bg-card border border-border/60 rounded-2xl p-6 flex flex-col gap-4 feature-card">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground flex-1" dir={ar ? 'rtl' : 'ltr'}>
                "{ar ? t.message.ar : t.message.en}"
              </p>
              <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${t.color}`}>{t.avatar}</div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{ar ? t.role.ar : t.role.en}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default TestimonialsSection;
