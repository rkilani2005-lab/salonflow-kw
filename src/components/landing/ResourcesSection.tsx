import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const resources = [
  {
    titleKey: 'resources.guide1.title',
    descKey: 'resources.guide1.desc',
    icon: FileText,
    color: 'from-primary to-primary/60',
  },
  {
    titleKey: 'resources.guide2.title',
    descKey: 'resources.guide2.desc',
    icon: FileText,
    color: 'from-accent to-accent/60',
  },
  {
    titleKey: 'resources.guide3.title',
    descKey: 'resources.guide3.desc',
    icon: FileText,
    color: 'from-primary to-accent',
  },
];

const ResourcesSection = () => {
  const { t, isRTL } = useLanguage();
  
  return (
    <section id="resources" className="py-24 bg-muted/30 relative">
      <div className="absolute inset-0 grid-overlay opacity-20" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">{t('resources.title')}</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            {t('resources.subtitle')}
          </p>
        </div>
        
        {/* Resource Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {resources.map((resource) => {
            const Icon = resource.icon;
            
            return (
              <div 
                key={resource.titleKey}
                className="group bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-all hover:shadow-lg"
              >
                {/* Icon */}
                <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${resource.color} flex items-center justify-center mb-6`}>
                  <Icon className="w-7 h-7 text-primary-foreground" />
                </div>
                
                {/* Content */}
                <h3 className="font-display text-xl font-bold mb-2 text-foreground">
                  {t(resource.titleKey)}
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {t(resource.descKey)}
                </p>
                
                {/* Download button */}
                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-medium group-hover:translate-x-1 transition-transform">
                  <Download className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('resources.download')}
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
