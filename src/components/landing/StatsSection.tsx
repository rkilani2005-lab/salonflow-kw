import { useLanguage } from '@/contexts/LanguageContext';

const stats = [
  { value: '500+', labelKey: 'stats.salons' },
  { value: '50K+', labelKey: 'stats.bookings' },
  { value: '99.9%', labelKey: 'stats.uptime' },
  { value: '4.9', labelKey: 'stats.rating' },
];

const StatsSection = () => {
  const { t } = useLanguage();
  
  return (
    <section className="py-16 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat) => (
            <div key={stat.labelKey}>
              <div className="text-4xl md:text-5xl font-bold">{stat.value}</div>
              <div className="text-primary-foreground/80 mt-1">{t(stat.labelKey)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
