import { useLanguage } from '@/contexts/LanguageContext';
import { TrendingUp, Users, Clock, Zap } from 'lucide-react';

const stats = [
  { value: '500+', labelKey: 'stats.salons', icon: Users },
  { value: '50K+', labelKey: 'stats.bookings', icon: Clock },
  { value: '99.9%', labelKey: 'stats.uptime', icon: Zap },
  { value: '+40%', labelKey: 'stats.revenue', icon: TrendingUp },
];

const StatsSection = () => {
  const { t } = useLanguage();
  
  return (
    <section className="py-16 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-95" />
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.labelKey} className="text-center group">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary-foreground/10 mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="text-4xl md:text-5xl font-display font-bold text-primary-foreground mb-2">
                  {stat.value}
                </div>
                <div className="text-primary-foreground/80 font-medium">
                  {t(stat.labelKey)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
