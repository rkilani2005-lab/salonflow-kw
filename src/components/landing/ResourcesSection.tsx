import { Download, FileText, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const RESOURCES = [
  {
    icon: FileText,
    color: 'bg-primary/10 text-primary',
    en: { title: 'The AI Salon Playbook', desc: 'How to use AI to 10× your bookings and keep clients coming back. The complete guide for Kuwait salons.' },
    ar: { title: 'دليل الصالون الذكي', desc: 'كيف تستخدمين AI لمضاعفة حجوزاتك 10 مرات والاحتفاظ بعميلاتك. الدليل الكامل لصالونات الكويت.' },
  },
  {
    icon: TrendingUp,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    en: { title: 'Pricing Psychology for Salons', desc: 'How to charge premium prices in the Kuwait market without losing clients. Real strategies from top GCC salons.' },
    ar: { title: 'سيكولوجية التسعير للصالونات', desc: 'كيف ترفعين أسعارك في السوق الكويتي بدون خسارة العميلات. استراتيجيات حقيقية من أفضل صالونات الخليج.' },
  },
  {
    icon: Users,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    en: { title: 'Client Retention Masterclass', desc: 'The exact WhatsApp message templates and follow-up sequences that bring clients back every 3–4 weeks.' },
    ar: { title: 'دورة الاحتفاظ بالعميلات', desc: 'قوالب رسائل واتساب وتسلسلات المتابعة التي تُعيد العميلات كل 3-4 أسابيع.' },
  },
];

const ResourcesSection = () => {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  return (
    <section id="resources" className="py-24 bg-muted/30" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-3">
            {ar ? 'الموارد' : 'Free Resources'}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            <span className="text-gradient">{ar ? 'طوّري مستواك' : 'Level up your game'}</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {ar ? 'أدلة مجانية للسيطرة على سوقك' : 'Free guides to dominate your market'}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {RESOURCES.map(r => {
            const Icon = r.icon;
            const content = ar ? r.ar : r.en;
            return (
              <div key={content.title} className="bg-card border border-border/60 rounded-2xl p-6 flex flex-col gap-4 feature-card">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${r.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>{content.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{content.desc}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 w-fit border-primary/30 text-primary hover:bg-primary/5">
                  <Download className="h-3.5 w-3.5" />
                  {ar ? 'تحميل مجاني' : 'Download Free'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ResourcesSection;
