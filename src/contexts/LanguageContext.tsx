import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const translations: Record<string, Record<Language, string>> = {
  // Navigation
  'nav.features': { en: 'Features', ar: 'المميزات' },
  'nav.pricing': { en: 'Pricing', ar: 'الأسعار' },
  'nav.resources': { en: 'Resources', ar: 'الموارد' },
  'nav.testimonials': { en: 'Testimonials', ar: 'آراء العملاء' },
  'nav.signin': { en: 'Sign In', ar: 'تسجيل الدخول' },
  'nav.trial': { en: 'Get Smarter', ar: 'ابدأ بذكاء' },
  
  // Hero - ZAINA edgy copy
  'hero.badge': { en: 'AI-Powered Intelligence', ar: 'ذكاء مدعوم بالـ AI' },
  'hero.title1': { en: 'The unfair advantage', ar: 'الميزة غير العادلة' },
  'hero.title2': { en: 'for your salon.', ar: 'لصالونك.' },
  'hero.subtitle': { en: 'Run your salon on autopilot. ZAINA is the AI brain that fills your seats, knows your clients, and grows your business while you focus on what you do best.', ar: 'شغّل صالونك بالطيّار الآلي. ZAINA هي العقل الذكي الذي يملأ مقاعدك، يعرف عملاءك، وينمي عملك بينما تركز على ما تتقنه.' },
  'hero.cta': { en: 'Get Smarter', ar: 'ابدأ بذكاء' },
  'hero.demo': { en: 'See It In Action', ar: 'شاهد العرض' },
  'hero.trusted': { en: 'Trusted by 500+ salons across Kuwait', ar: 'موثوق به من قبل أكثر من 500 صالون في الكويت' },
  
  // Smart Powers (Features)
  'powers.title': { en: 'Your Salon\'s Smart Powers', ar: 'قوى صالونك الذكية' },
  'powers.subtitle': { en: 'Stop managing. Start dominating.', ar: 'توقف عن الإدارة. ابدأ بالسيطرة.' },
  
  'powers.booking.title': { en: 'AI-Powered Scheduling', ar: 'جدولة مدعومة بالـ AI' },
  'powers.booking.desc': { en: 'It knows your busiest times before you do. Fill seats effortlessly with predictive booking that maximizes every hour.', ar: 'يعرف أوقات ذروتك قبلك. املأ المقاعد بسهولة مع حجوزات تنبؤية تستغل كل ساعة.' },
  
  'powers.clients.title': { en: 'Client Intelligence', ar: 'ذكاء العملاء' },
  'powers.clients.desc': { en: 'Know exactly what they want before they walk in. Personalization at scale that makes every client feel like a VIP.', ar: 'اعرف ما يريدون قبل دخولهم. تخصيص واسع يجعل كل عميل يشعر بأنه VIP.' },
  
  'powers.analytics.title': { en: 'Revenue Prediction', ar: 'توقع الإيرادات' },
  'powers.analytics.desc': { en: 'See the future of your business. AI analytics that spot trends, catch problems, and find opportunities you\'d miss.', ar: 'شاهد مستقبل عملك. تحليلات AI تكتشف الاتجاهات والمشاكل والفرص التي قد تفوتك.' },
  
  'powers.marketing.title': { en: 'Smart Campaigns', ar: 'حملات ذكية' },
  'powers.marketing.desc': { en: 'Marketing that thinks for itself. Automated messages that hit at the right moment and bring clients back.', ar: 'تسويق يفكر بنفسه. رسائل آلية تصل في الوقت المناسب وتعيد العملاء.' },
  
  // Stats
  'stats.salons': { en: 'Active Salons', ar: 'صالون نشط' },
  'stats.bookings': { en: 'Monthly Bookings', ar: 'حجز شهرياً' },
  'stats.uptime': { en: 'Uptime', ar: 'وقت التشغيل' },
  'stats.revenue': { en: 'Revenue Boost', ar: 'زيادة الإيرادات' },
  
  // Testimonials (DM style)
  'testimonials.title': { en: 'The Vibe Check', ar: 'آراء أصحاب الصالونات' },
  'testimonials.subtitle': { en: 'Real salon owners. Real results.', ar: 'أصحاب صالونات حقيقيون. نتائج حقيقية.' },
  
  // Pricing
  'pricing.title': { en: 'Pick Your Power Level', ar: 'اختر مستوى قوتك' },
  'pricing.subtitle': { en: 'All plans include 14-day free trial. No credit card required.', ar: 'جميع الخطط تشمل تجربة مجانية 14 يوم. بدون بطاقة ائتمان.' },
  'pricing.month': { en: 'KWD/mo', ar: 'د.ك/شهر' },
  'pricing.popular': { en: 'Most Popular', ar: 'الأكثر شعبية' },
  'pricing.start': { en: 'Start Free', ar: 'ابدأ مجاناً' },
  
  'pricing.starter.name': { en: 'Starter', ar: 'المبتدئ' },
  'pricing.starter.desc': { en: 'For solo stylists', ar: 'للمستقلين' },
  'pricing.pro.name': { en: 'Pro', ar: 'المحترف' },
  'pricing.pro.desc': { en: 'For growing salons', ar: 'للصالونات النامية' },
  'pricing.ai.name': { en: 'AI Ultimate', ar: 'AI الأقصى' },
  'pricing.ai.desc': { en: 'Full AI power', ar: 'قوة AI كاملة' },
  
  // Resources
  'resources.title': { en: 'Level Up Your Game', ar: 'طوّر مستواك' },
  'resources.subtitle': { en: 'Free guides to dominate your market.', ar: 'أدلة مجانية للسيطرة على سوقك.' },
  'resources.download': { en: 'Download Free', ar: 'تحميل مجاني' },
  
  'resources.guide1.title': { en: 'The AI Salon Playbook', ar: 'دليل الصالون الذكي' },
  'resources.guide1.desc': { en: 'How to use AI to 10x your bookings and client retention.', ar: 'كيف تستخدم AI لمضاعفة حجوزاتك 10 مرات.' },
  
  'resources.guide2.title': { en: 'Instagram Growth Hacks', ar: 'حيل نمو انستغرام' },
  'resources.guide2.desc': { en: 'The exact strategies top Kuwait salons use to go viral.', ar: 'الاستراتيجيات التي تستخدمها صالونات الكويت للانتشار.' },
  
  'resources.guide3.title': { en: 'Pricing Psychology', ar: 'سيكولوجية التسعير' },
  'resources.guide3.desc': { en: 'How to charge premium prices without losing clients.', ar: 'كيف ترفع أسعارك بدون خسارة العملاء.' },
  
  // CTA
  'cta.title': { en: 'Stop managing.', ar: 'توقف عن الإدارة.' },
  'cta.title2': { en: 'Start growing.', ar: 'ابدأ بالنمو.' },
  'cta.subtitle': { en: 'Join 500+ salon owners using ZAINA to dominate their market.', ar: 'انضم لأكثر من 500 صاحب صالون يستخدمون ZAINA للسيطرة على سوقهم.' },
  'cta.nolimit': { en: 'No credit card • No setup fees • Cancel anytime', ar: 'بدون بطاقة ائتمان • بدون رسوم إعداد • إلغاء في أي وقت' },
  
  // Footer
  'footer.product': { en: 'Product', ar: 'المنتج' },
  'footer.company': { en: 'Company', ar: 'الشركة' },
  'footer.support': { en: 'Support', ar: 'الدعم' },
  'footer.about': { en: 'About', ar: 'عن الشركة' },
  'footer.blog': { en: 'Blog', ar: 'المدونة' },
  'footer.careers': { en: 'Careers', ar: 'الوظائف' },
  'footer.help': { en: 'Help Center', ar: 'مركز المساعدة' },
  'footer.contact': { en: 'Contact', ar: 'اتصل بنا' },
  'footer.privacy': { en: 'Privacy Policy', ar: 'سياسة الخصوصية' },
  'footer.demo': { en: 'Demo', ar: 'عرض توضيحي' },
  'footer.copyright': { en: '© 2024 ZAINA. All rights reserved. Built with ⚡ in Kuwait.', ar: '© 2024 ZAINA. جميع الحقوق محفوظة. صُنع بـ ⚡ في الكويت.' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en');
  
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);
  
  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };
  
  const isRTL = language === 'ar';
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
