import { useLanguage } from '@/contexts/LanguageContext';

const STATS = [
  { value: '500+', en: 'Active Salons',     ar: 'صالون نشط' },
  { value: '50K+', en: 'Monthly Bookings',  ar: 'حجز شهرياً' },
  { value: '99.9%',en: 'Uptime SLA',        ar: 'وقت التشغيل' },
  { value: '+40%', en: 'Revenue Boost',     ar: 'زيادة الإيرادات' },
];

const StatsSection = () => {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  return (
    <section className="py-16 relative overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-95" />
      <div className="absolute inset-0 grid-overlay opacity-10" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(s => (
            <div key={s.value}>
              <p className="text-4xl md:text-5xl font-bold text-white mb-1 stat-number" style={{ fontFamily: 'Syne, sans-serif' }}>{s.value}</p>
              <p className="text-white/75 text-sm font-medium">{ar ? s.ar : s.en}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default StatsSection;
