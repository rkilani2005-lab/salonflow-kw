import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, CreditCard, Package, BarChart3, Bot, Scissors, Zap } from 'lucide-react';

const FEATURES = [
  { icon: Calendar, color: 'bg-primary/10 text-primary',
    en: { title: 'Smart Booking', desc: 'AI-powered scheduling that fills gaps automatically and sends WhatsApp confirmations.' },
    ar: { title: 'حجز ذكي', desc: 'جدولة مدعومة بالذكاء الاصطناعي تملأ الفجوات تلقائياً وترسل تأكيدات واتساب.' } },
  { icon: Users, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    en: { title: 'Client Intelligence', desc: 'Know which clients are at risk of leaving before they go. Auto-generate re-engagement messages.' },
    ar: { title: 'ذكاء العميلات', desc: 'اعرفي أي العميلات على وشك المغادرة قبل أن يفعلن. أنشئي رسائل إعادة تفاعل تلقائياً.' } },
  { icon: Bot, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    en: { title: 'WhatsApp AI Agent', desc: 'Bilingual AI handles bookings, FAQs, and reminders 24/7 in Arabic and English.' },
    ar: { title: 'وكيل واتساب AI', desc: 'ذكاء اصطناعي ثنائي اللغة يتعامل مع الحجوزات والأسئلة والتذكيرات 24/7 بالعربية والإنجليزية.' } },
  { icon: BarChart3, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    en: { title: 'Live Analytics', desc: 'Real-time revenue, staff performance, peak hours heatmap, and client retention reports.' },
    ar: { title: 'تحليلات فورية', desc: 'إيرادات فورية، أداء الموظفات، خريطة أوقات الذروة، وتقارير الاحتفاظ بالعميلات.' } },
  { icon: Package, color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    en: { title: 'Smart Inventory', desc: 'AI predicts stock needs, auto-generates purchase orders, and tracks product usage per service.' },
    ar: { title: 'مخزون ذكي', desc: 'الذكاء الاصطناعي يتوقع احتياجات المخزون، ينشئ طلبات الشراء تلقائياً، ويتتبع استخدام المنتجات.' } },
  { icon: CreditCard, color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    en: { title: 'Kuwait POS', desc: 'KNET, cash, credit card, split payments. Print receipts, apply discounts with manager approval.' },
    ar: { title: 'نقطة بيع كويتية', desc: 'كي نت، نقداً، بطاقة ائتمان، دفع مقسّم. طباعة إيصالات، تطبيق خصومات مع موافقة المدير.' } },
  { icon: Scissors, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    en: { title: 'Staff & Commissions', desc: 'Track performance, auto-calculate commissions, manage working hours and service assignments.' },
    ar: { title: 'الموظفات والعمولات', desc: 'تتبع الأداء، احسب العمولات تلقائياً، أدير ساعات العمل وتعيينات الخدمات.' } },
  { icon: Zap, color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
    en: { title: 'Multi-Branch', desc: 'Manage all branches from one dashboard. Branch switching, separate reports, shared client database.' },
    ar: { title: 'تعدد الفروع', desc: 'أديري جميع الفروع من لوحة تحكم واحدة. تبديل الفروع، تقارير منفصلة، قاعدة بيانات عميلات مشتركة.' } },
];

const FeaturesSection = () => {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  return (
    <section id="features" className="py-24" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-6">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 px-3 py-1.5 text-xs font-semibold border-primary/30 bg-primary/8 text-primary">
            {ar ? 'المميزات' : 'Features'}
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
            {ar ? 'كل ما تحتاجينه في مكان واحد' : 'Everything your salon needs'}
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {ar ? 'منصة متكاملة مصممة خصيصاً لصالونات السيدات في الكويت والخليج العربي' : 'A complete platform built specifically for ladies salons in Kuwait and the GCC region'}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {FEATURES.map(f => {
            const Icon = f.icon;
            const content = ar ? f.ar : f.en;
            return (
              <div key={content.title} className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col gap-3 feature-card">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${f.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>{content.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{content.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
export default FeaturesSection;
