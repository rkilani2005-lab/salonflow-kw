import { useLanguage } from '@/contexts/LanguageContext';
import { MessageCircle, Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Fatima Al-Rashid',
    handle: '@fatima_glam',
    avatar: 'F',
    role: 'Owner, Glam Studio Kuwait',
    message: {
      en: 'ZAINA literally saved my business. Went from chaotic bookings to running on autopilot. My revenue is up 45% 🚀',
      ar: 'ZAINA أنقذت عملي حرفياً. انتقلت من الفوضى إلى العمل بشكل آلي. إيراداتي ارتفعت 45% 🚀'
    }
  },
  {
    name: 'Khalid Mansour',
    handle: '@khalid_barber',
    avatar: 'K',
    role: 'Founder, The Grooming Lounge',
    message: {
      en: 'The AI predictions are insane. It knows when my shop will be busy before I do. Game changer for staffing. 💯',
      ar: 'توقعات الـ AI جنونية. يعرف متى سيكون محلي مشغولاً قبلي. غيّرت قواعد اللعبة للتوظيف. 💯'
    }
  },
  {
    name: 'Noura Hassan',
    handle: '@noura_nails',
    avatar: 'N',
    role: 'CEO, Nail Art Kuwait',
    message: {
      en: 'My clients love the personalized reminders. No more no-shows. ZAINA pays for itself 10x over. 💅✨',
      ar: 'عملائي يحبون التذكيرات المخصصة. لا مزيد من الغياب. ZAINA تسترد تكلفتها 10 أضعاف. 💅✨'
    }
  },
];

const TestimonialsSection = () => {
  const { t, language, isRTL } = useLanguage();
  
  return (
    <section id="testimonials" className="py-24 bg-muted/30 relative">
      {/* Background pattern */}
      <div className="absolute inset-0 grid-overlay opacity-20" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">{t('testimonials.title')}</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            {t('testimonials.subtitle')}
          </p>
        </div>
        
        {/* DM-style testimonial cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div 
              key={testimonial.handle}
              className="bg-card rounded-2xl border border-border p-6 hover:border-primary/30 transition-all hover:shadow-lg group"
            >
              {/* DM header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {testimonial.avatar}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.handle}</div>
                </div>
                <MessageCircle className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Message bubble */}
              <div className="bg-muted/50 rounded-2xl rounded-tl-md p-4 mb-4">
                <p className="text-foreground leading-relaxed">
                  {testimonial.message[language]}
                </p>
              </div>
              
              {/* Role & rating */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{testimonial.role}</span>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
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
