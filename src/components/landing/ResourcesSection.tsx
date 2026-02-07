import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Instagram, FileText, Brain } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const resources = [
  {
    icon: Instagram,
    titleKey: 'resources.guide1.title',
    descKey: 'resources.guide1.desc',
    isNew: true,
    color: 'bg-gradient-to-br from-purple-500 to-pink-500',
  },
  {
    icon: FileText,
    titleKey: 'resources.guide2.title',
    descKey: 'resources.guide2.desc',
    isNew: false,
    color: 'bg-gradient-to-br from-blue-500 to-cyan-500',
  },
  {
    icon: Brain,
    titleKey: 'resources.guide3.title',
    descKey: 'resources.guide3.desc',
    isNew: true,
    color: 'bg-gradient-to-br from-primary to-orange-500',
  },
];

const ResourcesSection = () => {
  const { t, language } = useLanguage();
  
  return (
    <section id="resources" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 border-primary text-primary">
            {language === 'ar' ? 'الموارد' : 'Resources'}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('resources.title')}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('resources.subtitle')}
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {resources.map((resource) => {
            const Icon = resource.icon;
            
            return (
              <Card key={resource.titleKey} className="border-2 hover:border-primary/50 transition-colors group overflow-hidden">
                <CardHeader className="p-0">
                  <div className={`h-32 ${resource.color} flex items-center justify-center relative`}>
                    {resource.isNew && (
                      <Badge className="absolute top-3 left-3 bg-white text-foreground">
                        {language === 'ar' ? 'جديد' : 'new'}
                      </Badge>
                    )}
                    <Icon className="w-12 h-12 text-white" />
                  </div>
                </CardHeader>
                
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                    {t(resource.titleKey)}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t(resource.descKey)}
                  </p>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    {t('resources.download')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ResourcesSection;
