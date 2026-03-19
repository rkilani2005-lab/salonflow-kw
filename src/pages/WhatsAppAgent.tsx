import { Bot, MessageSquare, Settings2, History, Sparkles, Zap, Phone } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { WhatsAppSettings } from '@/components/whatsapp/WhatsAppSettings';
import { ChatSimulator } from '@/components/whatsapp/ChatSimulator';
import { ConversationLog } from '@/components/whatsapp/ConversationLog';
import { useLanguage } from '@/contexts/LanguageContext';

export default function WhatsAppAgent() {
  const { language } = useLanguage();
  const ar = language === 'ar';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ── */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C0395E] to-[#D4956A] flex items-center justify-center shadow-lg">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-zinc-900" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-zinc-100" style={{ fontFamily: 'Syne, sans-serif' }}>
                ZAINA AI Agent
              </h1>
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 rounded-full font-bold">
                LIVE
              </Badge>
            </div>
            <p className="text-xs text-zinc-500">
              {ar ? 'مساعد الحجز الذكي • ثنائي اللغة AR/EN' : 'Bilingual booking assistant • AR/EN · Kuwait 🇰🇼'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500">
              <Zap className="h-3 w-3 text-[#C0395E]" />
              {ar ? 'مدعوم بـ' : 'Powered by'}
              <span className="font-bold text-zinc-300">Claude AI</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Capability pills ── */}
      <div className="border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex gap-2 overflow-x-auto scrollbar-none">
          {[
            { icon: '📱', label: ar ? 'حجز تلقائي' : 'Auto-booking' },
            { icon: '🌐', label: ar ? 'عربي / إنجليزي' : 'Arabic / English' },
            { icon: '💰', label: ar ? 'تقارير فورية' : 'Live reports' },
            { icon: '🔔', label: ar ? 'تذكيرات تلقائية' : 'Auto-reminders' },
            { icon: '🤝', label: ar ? 'تحويل لموظفة' : 'Human handoff' },
            { icon: '📊', label: ar ? 'ذكاء الأعمال' : 'Business intel' },
          ].map(c => (
            <span key={c.label} className="flex-shrink-0 flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/60 px-2.5 py-1 rounded-full border border-zinc-700/50">
              <span>{c.icon}</span>{c.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="simulator" className="space-y-5">
          <TabsList className="bg-zinc-900 border border-zinc-800 p-1 h-9">
            <TabsTrigger value="simulator" className="text-xs gap-1.5 data-[state=active]:bg-[#C0395E] data-[state=active]:text-white">
              <MessageSquare className="h-3.5 w-3.5" />
              {ar ? 'المحاكي' : 'Simulator'}
            </TabsTrigger>
            <TabsTrigger value="conversations" className="text-xs gap-1.5 data-[state=active]:bg-[#C0395E] data-[state=active]:text-white">
              <History className="h-3.5 w-3.5" />
              {ar ? 'المحادثات' : 'Conversations'}
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs gap-1.5 data-[state=active]:bg-[#C0395E] data-[state=active]:text-white">
              <Settings2 className="h-3.5 w-3.5" />
              {ar ? 'الإعدادات' : 'Settings'}
            </TabsTrigger>
          </TabsList>

          {/* ── Simulator tab ── */}
          <TabsContent value="simulator" className="mt-0">
            <div className="grid gap-5 lg:grid-cols-5">
              <div className="lg:col-span-3 h-[620px]">
                <ChatSimulator />
              </div>
              <div className="lg:col-span-2 space-y-4">
                {/* Try these prompts */}
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                    {ar ? 'جرب هذه الرسائل' : 'Try these prompts'}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold text-[#C0395E] uppercase tracking-wider mb-1.5">
                        {ar ? '👩‍🦱 وضع العميلة' : '👩‍🦱 Customer mode'}
                      </p>
                      {[
                        ar ? 'أريد حجز موعد لقص الشعر' : 'I want to book a haircut',
                        ar ? 'ما هي خدماتكم وأسعارها؟' : 'What services do you offer?',
                        ar ? 'هل يوجد مواعيد غداً؟' : 'Any slots available tomorrow?',
                        ar ? 'أريد إلغاء موعدي' : 'I need to cancel my appointment',
                      ].map(p => (
                        <div key={p} className="text-xs text-zinc-400 bg-zinc-800/60 rounded-lg px-3 py-1.5 mb-1 border border-zinc-700/40 cursor-default hover:border-zinc-600 transition-colors" dir={ar?'rtl':'ltr'}>
                          {p}
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-[#D4956A] uppercase tracking-wider mb-1.5">
                        {ar ? '👔 وضع المدير' : '👔 Admin mode'}
                      </p>
                      {[
                        ar ? 'ما إيرادات اليوم؟' : "What's today's revenue?",
                        ar ? 'من هي أفضل موظفة هذا الأسبوع؟' : 'Top performer this week?',
                        ar ? 'أظهري لي تقرير الشهر' : 'Show me the monthly report',
                        ar ? 'ما المخزون الشحيح؟' : 'What products are running low?',
                      ].map(p => (
                        <div key={p} className="text-xs text-zinc-400 bg-zinc-800/60 rounded-lg px-3 py-1.5 mb-1 border border-zinc-700/40 cursor-default hover:border-zinc-600 transition-colors" dir={ar?'rtl':'ltr'}>
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Status card */}
                <div className="bg-gradient-to-br from-[#C0395E]/10 to-[#D4956A]/5 rounded-2xl border border-[#C0395E]/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-[#C0395E]" />
                    <p className="text-sm font-semibold text-zinc-200">{ar ? 'الميزات النشطة' : 'Active capabilities'}</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: ar ? 'كشف اللغة التلقائي' : 'Auto language detection', on: true },
                      { label: ar ? 'الحجز عبر الدردشة' : 'Chat-to-booking', on: true },
                      { label: ar ? 'ذكاء الأعمال' : 'Business intelligence', on: true },
                      { label: ar ? 'تحويل للموظفة' : 'Human handoff', on: true },
                      { label: ar ? 'الرسائل الصوتية' : 'Voice messages', on: false },
                    ].map(f => (
                      <div key={f.label} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">{f.label}</span>
                        <span className={f.on ? 'text-emerald-400 font-semibold' : 'text-zinc-600'}>
                          {f.on ? '✓ ON' : '○ Soon'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="conversations" className="mt-0">
            <ConversationLog />
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <WhatsAppSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
