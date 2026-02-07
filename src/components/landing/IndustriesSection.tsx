import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scissors, Sparkles, Heart, Flower2, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const industries = [
  {
    id: 'nail',
    icon: Sparkles,
    labelKey: 'industries.nail',
    testimonial: {
      quote: 'SalonFlow has been the easiest salon software I\'ve used in 12 years. A complete life saver for our nail studio.',
      author: 'سارة المطيري',
      role: 'Glamour Nails Kuwait',
    },
    quoteAr: 'SalonFlow هو أسهل برنامج صالون استخدمته منذ 12 عاماً. منقذ حقيقي لاستوديو الأظافر الخاص بنا.',
  },
  {
    id: 'hair',
    icon: Scissors,
    labelKey: 'industries.hair',
    testimonial: {
      quote: 'The AI-powered scheduling has reduced our no-shows to almost zero. Our business runs more efficiently than ever.',
      author: 'نورة الصباح',
      role: 'Beauty Hub Kuwait',
    },
    quoteAr: 'قللت الجدولة المدعومة بالذكاء الاصطناعي من حالات عدم الحضور إلى ما يقرب من الصفر. أعمالنا تسير بكفاءة أكثر من أي وقت مضى.',
  },
  {
    id: 'beauty',
    icon: Heart,
    labelKey: 'industries.beauty',
    testimonial: {
      quote: 'Managing appointments and inventory has never been easier. The Arabic interface is perfect for our clients.',
      author: 'فاطمة الرشيد',
      role: 'Glamour Ladies Salon',
    },
    quoteAr: 'لم تكن إدارة المواعيد والمخزون أسهل من قبل. الواجهة العربية مثالية لعملائنا.',
  },
  {
    id: 'spa',
    icon: Flower2,
    labelKey: 'industries.spa',
    testimonial: {
      quote: 'The multi-branch feature lets me manage all 3 locations from my phone. Highly recommend for any spa owner.',
      author: 'ليلى العنزي',
      role: 'Serenity Spa Kuwait',
    },
    quoteAr: 'ميزة الفروع المتعددة تتيح لي إدارة جميع المواقع الثلاثة من هاتفي. أوصي بها بشدة لأي صاحب سبا.',
  },
  {
    id: 'barber',
    icon: User,
    labelKey: 'industries.barber',
    testimonial: {
      quote: 'The entire salon in your pocket! Remote access, employee rosters, and statistics all in one place.',
      author: 'محمد الفضلي',
      role: 'Elite Barbers Kuwait',
    },
    quoteAr: 'الصالون بأكمله في جيبك! الوصول عن بعد، وجداول الموظفين، والإحصائيات كلها في مكان واحد.',
  },
];

const IndustriesSection = () => {
  const { t, language } = useLanguage();
  const [activeIndustry, setActiveIndustry] = useState(industries[0]);
  
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          {t('industries.title')}
        </h2>
        
        {/* Industry tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {industries.map((industry) => {
            const Icon = industry.icon;
            const isActive = activeIndustry.id === industry.id;
            
            return (
              <Button
                key={industry.id}
                variant={isActive ? 'default' : 'outline'}
                onClick={() => setActiveIndustry(industry)}
                className={`gap-2 ${isActive ? '' : 'border-primary/30'}`}
              >
                <Icon className="w-4 h-4" />
                {t(industry.labelKey)}
              </Button>
            );
          })}
        </div>
        
        {/* Testimonial card */}
        <Card className="max-w-3xl mx-auto border-2">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <activeIndustry.icon className="w-10 h-10 text-primary" />
            </div>
            
            <p className="text-lg text-muted-foreground mb-4">
              {t(activeIndustry.labelKey)}
            </p>
            
            <blockquote className="text-xl md:text-2xl font-medium mb-6 leading-relaxed">
              "{language === 'ar' ? activeIndustry.quoteAr : activeIndustry.testimonial.quote}"
            </blockquote>
            
            <div>
              <p className="font-semibold">{activeIndustry.testimonial.author}</p>
              <p className="text-sm text-muted-foreground">{activeIndustry.testimonial.role}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default IndustriesSection;
