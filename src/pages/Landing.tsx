import { LanguageProvider } from '@/contexts/LanguageContext';
import LandingNav from '@/components/landing/LandingNav';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import StatsSection from '@/components/landing/StatsSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import PricingSection from '@/components/landing/PricingSection';
import ResourcesSection from '@/components/landing/ResourcesSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

const Landing = () => {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-background">
        <LandingNav />
        <HeroSection />
        <FeaturesSection />
        <StatsSection />
        <TestimonialsSection />
        <PricingSection />
        <ResourcesSection />
        <CTASection />
        <Footer />
      </div>
    </LanguageProvider>
  );
};

export default Landing;
