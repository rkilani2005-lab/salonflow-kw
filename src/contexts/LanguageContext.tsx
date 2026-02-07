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
  'nav.trial': { en: 'Start Free Trial', ar: 'ابدأ التجربة المجانية' },
  
  // Hero
  'hero.title1': { en: 'Salon Management', ar: 'إدارة الصالونات' },
  'hero.title2': { en: 'Powered by AI', ar: 'مدعومة بالذكاء الاصطناعي' },
  'hero.subtitle': { en: 'The first AI-powered salon management platform built for Kuwait. Automate bookings, predict trends, and grow your business.', ar: 'أول منصة لإدارة الصالونات مدعومة بالذكاء الاصطناعي في الكويت. أتمتة الحجوزات، توقع الاتجاهات، وتنمية أعمالك.' },
  'hero.cta': { en: 'Start Free Trial', ar: 'ابدأ التجربة المجانية' },
  'hero.demo': { en: 'Request Demo', ar: 'اطلب عرض توضيحي' },
  'hero.trusted': { en: 'Trusted by 500+ salons across Kuwait', ar: 'موثوق به من قبل أكثر من 500 صالون في الكويت' },
  
  // Features section
  'features.tagline': { en: 'We keep your business on pace with your passion.', ar: 'نحافظ على عملك بمستوى شغفك.' },
  
  'features.time.title': { en: 'Save Your Time', ar: 'وفّر وقتك' },
  'features.time.desc': { en: 'Say goodbye to the race against time. Our AI-powered automation handles appointment reminders, client follow-ups, and scheduling conflicts automatically.', ar: 'قل وداعاً للسباق مع الوقت. تتولى الأتمتة المدعومة بالذكاء الاصطناعي إرسال تذكيرات المواعيد ومتابعة العملاء وحل تعارضات المواعيد تلقائياً.' },
  'features.time.item1': { en: 'AI-powered appointment optimization', ar: 'تحسين المواعيد بالذكاء الاصطناعي' },
  'features.time.item2': { en: 'Smart client database & history', ar: 'قاعدة بيانات ذكية للعملاء' },
  'features.time.item3': { en: 'Automated marketing campaigns', ar: 'حملات تسويقية آلية' },
  
  'features.manage.title': { en: 'Manage Easily', ar: 'إدارة سهلة' },
  'features.manage.desc': { en: 'Managing a salon can be easy, pleasant and stress-free. Create an efficient team, track inventory, and control everything from your phone—anywhere, anytime.', ar: 'يمكن أن تكون إدارة الصالون سهلة وممتعة وخالية من التوتر. أنشئ فريقاً فعالاً، تتبع المخزون، وتحكم في كل شيء من هاتفك.' },
  'features.manage.item1': { en: 'Multi-branch dashboard', ar: 'لوحة تحكم متعددة الفروع' },
  'features.manage.item2': { en: 'Employee scheduling & commissions', ar: 'جدولة الموظفين والعمولات' },
  'features.manage.item3': { en: 'Inventory & stock control', ar: 'التحكم في المخزون' },
  
  'features.customers.title': { en: 'Attract More Customers', ar: 'اجذب المزيد من العملاء' },
  'features.customers.desc': { en: 'AI-powered marketing tools are your secret weapon. Our system predicts client behavior, sends personalized offers, and fills your calendar 24/7.', ar: 'أدوات التسويق المدعومة بالذكاء الاصطناعي هي سلاحك السري. نظامنا يتنبأ بسلوك العميل ويرسل عروضاً مخصصة ويملأ جدولك على مدار الساعة.' },
  'features.customers.item1': { en: '24/7 online booking with AI', ar: 'حجز على مدار الساعة مع الذكاء الاصطناعي' },
  'features.customers.item2': { en: 'Personalized SMS & WhatsApp', ar: 'رسائل نصية وواتساب مخصصة' },
  'features.customers.item3': { en: 'Smart loyalty program', ar: 'برنامج ولاء ذكي' },
  
  'features.success.title': { en: 'Measure Your Success', ar: 'قِس نجاحك' },
  'features.success.desc': { en: 'AI-powered analytics turn your data into actionable insights. See revenue predictions, identify top performers, and catch potential issues before they happen.', ar: 'تحول التحليلات المدعومة بالذكاء الاصطناعي بياناتك إلى رؤى قابلة للتنفيذ. شاهد توقعات الإيرادات وحدد الأفضل أداءً.' },
  'features.success.item1': { en: 'Predictive revenue analytics', ar: 'تحليلات تنبؤية للإيرادات' },
  'features.success.item2': { en: 'Employee performance insights', ar: 'رؤى أداء الموظفين' },
  'features.success.item3': { en: 'Customer churn prediction', ar: 'توقع تراجع العملاء' },
  
  // Stats
  'stats.salons': { en: 'Active Salons', ar: 'صالون نشط' },
  'stats.bookings': { en: 'Monthly Bookings', ar: 'حجز شهرياً' },
  'stats.uptime': { en: 'Uptime', ar: 'وقت التشغيل' },
  'stats.rating': { en: 'Customer Rating', ar: 'تقييم العملاء' },
  
  // Industries
  'industries.title': { en: 'See how SalonFlow works', ar: 'شاهد كيف يعمل SalonFlow' },
  'industries.nail': { en: 'Nail Studios', ar: 'استوديوهات الأظافر' },
  'industries.hair': { en: 'Hair Salons', ar: 'صالونات الشعر' },
  'industries.beauty': { en: 'Beauty Salons', ar: 'صالونات التجميل' },
  'industries.spa': { en: 'SPAs & Wellness', ar: 'السبا والعافية' },
  'industries.barber': { en: 'Barbershops', ar: 'صالونات الحلاقة' },
  
  // Pricing
  'pricing.title': { en: 'Simple, Transparent Pricing', ar: 'أسعار بسيطة وشفافة' },
  'pricing.subtitle': { en: 'Choose the plan that fits your salon. All plans include a 14-day free trial.', ar: 'اختر الخطة التي تناسب صالونك. جميع الخطط تشمل تجربة مجانية لمدة 14 يوماً.' },
  'pricing.month': { en: 'KWD/month', ar: 'د.ك/شهر' },
  'pricing.popular': { en: 'Most Popular', ar: 'الأكثر شعبية' },
  'pricing.start': { en: 'Start Free Trial', ar: 'ابدأ التجربة' },
  
  // Resources
  'resources.title': { en: 'Resources & Guides', ar: 'الموارد والأدلة' },
  'resources.subtitle': { en: 'Learn how to grow your salon business with our free resources.', ar: 'تعلم كيفية تنمية أعمال صالونك مع مواردنا المجانية.' },
  'resources.guide1.title': { en: 'Instagram Marketing for Salons', ar: 'التسويق عبر انستغرام للصالونات' },
  'resources.guide1.desc': { en: 'Master the art of social media marketing with tips from industry experts.', ar: 'أتقن فن التسويق عبر وسائل التواصل الاجتماعي مع نصائح خبراء الصناعة.' },
  'resources.guide2.title': { en: 'Salon Operations Manual', ar: 'دليل عمليات الصالون' },
  'resources.guide2.desc': { en: 'A complete checklist for creating efficient salon procedures.', ar: 'قائمة تحقق كاملة لإنشاء إجراءات صالون فعالة.' },
  'resources.guide3.title': { en: 'AI in Beauty Industry', ar: 'الذكاء الاصطناعي في صناعة التجميل' },
  'resources.guide3.desc': { en: 'How artificial intelligence is transforming salon management in Kuwait.', ar: 'كيف يغير الذكاء الاصطناعي إدارة الصالونات في الكويت.' },
  'resources.download': { en: 'Download Free', ar: 'تحميل مجاني' },
  
  // CTA
  'cta.title': { en: 'Ready to Transform Your Salon?', ar: 'هل أنت مستعد لتحويل صالونك؟' },
  'cta.subtitle': { en: 'Join 500+ salon owners using AI to grow their business. Start your free 14-day trial today.', ar: 'انضم إلى أكثر من 500 صاحب صالون يستخدمون الذكاء الاصطناعي لتنمية أعمالهم. ابدأ تجربتك المجانية لمدة 14 يوماً اليوم.' },
  'cta.nolimit': { en: 'No limitations, no obligations, no cancellation fees.', ar: 'بدون قيود، بدون التزامات، بدون رسوم إلغاء.' },
  
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
  'footer.copyright': { en: '© 2024 SalonFlow. All rights reserved. Built with ❤️ in Kuwait.', ar: '© 2024 SalonFlow. جميع الحقوق محفوظة. صُنع بـ ❤️ في الكويت.' },
  
  // Testimonials
  'testimonials.title': { en: 'Trusted by Salon Owners', ar: 'موثوق به من أصحاب الصالونات' },
  'testimonials.subtitle': { en: 'See what salon owners across Kuwait are saying about SalonFlow.', ar: 'شاهد ما يقوله أصحاب الصالونات في الكويت عن SalonFlow.' },
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
