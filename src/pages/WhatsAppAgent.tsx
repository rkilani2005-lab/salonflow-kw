import { Bot, MessageSquare, Settings2, History, Zap, Layers, ListChecks } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { WhatsAppSetup }     from '@/components/whatsapp/WhatsAppSetup';
import { WhatsAppTriggers }  from '@/components/whatsapp/WhatsAppTriggers';
import { WhatsAppTemplates } from '@/components/whatsapp/WhatsAppTemplates';
import { WhatsAppSettings }  from '@/components/whatsapp/WhatsAppSettings';
import { ChatSimulator }     from '@/components/whatsapp/ChatSimulator';
import { ConversationLog }   from '@/components/whatsapp/ConversationLog';
import { useLanguage }       from '@/contexts/LanguageContext';
import { useAuth }           from '@/contexts/AuthContext';
import { useQuery }          from '@tanstack/react-query';
import { supabase }          from '@/integrations/supabase/client';

function useWAStatus() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['whatsapp-config', tenant?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('whatsapp_config')
        .select('is_enabled, connection_status, display_phone_number')
        .eq('tenant_id', tenant!.id)
        .maybeSingle();
      return data as { is_enabled: boolean; connection_status: string; display_phone_number: string } | null;
    },
    enabled: !!tenant?.id,
  });
}

export default function WhatsAppAgent() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const { data: status } = useWAStatus();

  const isConnected = status?.connection_status === 'connected';

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* ── Page header ── */}
      <div className="border-b bg-card px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="h-8 w-8 rounded-md bg-[#25D366]/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-[#25D366]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              {ar ? 'واتساب الذكي' : 'WhatsApp Business'}
            </h1>
            {isConnected ? (
              <Badge className="text-[9px] h-4 px-1.5 rounded-sm font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                ● {ar ? 'متصل' : 'Connected'} {status?.display_phone_number ? `· ${status.display_phone_number}` : ''}
              </Badge>
            ) : (
              <Badge className="text-[9px] h-4 px-1.5 rounded-sm font-bold bg-muted text-muted-foreground border border-border">
                ○ {ar ? 'غير متصل' : 'Not connected'}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {ar ? 'حجوزات تلقائية · رسائل مخصصة · تقارير فورية' : 'AI booking agent · automated triggers · bilingual AR/EN'}
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="setup" className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b bg-card px-6 flex-shrink-0">
            <TabsList className="h-10 bg-transparent gap-0 p-0 rounded-none">
              {[
                { value: 'setup',         icon: Settings2,  en: 'Setup',         ar: 'الإعداد' },
                { value: 'triggers',      icon: Zap,        en: 'Triggers',      ar: 'التشغيل التلقائي' },
                { value: 'templates',     icon: Layers,     en: 'Templates',     ar: 'القوالب' },
                { value: 'simulator',     icon: MessageSquare, en: 'Test Agent',  ar: 'اختبار الوكيل' },
                { value: 'conversations', icon: ListChecks, en: 'Conversations', ar: 'المحادثات' },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-10 px-4 text-xs font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground gap-1.5"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{ar ? tab.ar : tab.en}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Setup wizard */}
            <TabsContent value="setup" className="mt-0 p-6">
              <div className="mb-5">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {ar ? 'إعداد WhatsApp Business API' : 'WhatsApp Business API Setup'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {ar
                    ? 'اتبع الخطوات الخمس لتوصيل رقم واتساب الخاص بصالونك بنظام ZAINA'
                    : 'Follow the 5 steps to connect your salon\'s WhatsApp number to ZAINA'}
                </p>
              </div>
              <WhatsAppSetup />
            </TabsContent>

            {/* Triggers */}
            <TabsContent value="triggers" className="mt-0 p-6">
              <div className="mb-5">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {ar ? 'الرسائل التلقائية' : 'Automated Triggers'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {ar
                    ? 'شغّلي رسائل تُرسل تلقائياً من رقم واتساب صالونك عند وقوع أحداث محددة'
                    : 'Enable messages sent automatically from your salon\'s WhatsApp when specific events happen'}
                </p>
              </div>
              <WhatsAppTriggers />
            </TabsContent>

            {/* Templates */}
            <TabsContent value="templates" className="mt-0 p-6">
              <div className="mb-5">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {ar ? 'قوالب الرسائل' : 'Message Templates'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {ar
                    ? 'خصّصي نصوص الرسائل. المتغيرات مثل {{client_name}} تُستبدل تلقائياً'
                    : 'Customise message text. Variables like {{client_name}} are replaced automatically'}
                </p>
              </div>
              <WhatsAppTemplates />
            </TabsContent>

            {/* Simulator */}
            <TabsContent value="simulator" className="mt-0">
              <div className="max-w-4xl mx-auto p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {ar ? 'اختبار وكيل الذكاء الاصطناعي' : 'Test AI Agent'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {ar ? 'جربي محادثة مع الوكيل كما سيختبرها عميلاتك' : 'Simulate a conversation exactly as your clients will experience it'}
                  </p>
                </div>
                <ChatSimulator />
              </div>
            </TabsContent>

            {/* Conversations */}
            <TabsContent value="conversations" className="mt-0 p-6">
              <div className="mb-5">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {ar ? 'سجل المحادثات' : 'Conversation Log'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {ar ? 'جميع محادثات العميلات مع الوكيل الذكي' : 'All client conversations with the AI agent'}
                </p>
              </div>
              <ConversationLog />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
