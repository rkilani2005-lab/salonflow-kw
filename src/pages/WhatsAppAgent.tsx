import { Bot, MessageSquare, Settings2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WhatsAppSettings } from '@/components/whatsapp/WhatsAppSettings';
import { ChatSimulator } from '@/components/whatsapp/ChatSimulator';
import { ConversationLog } from '@/components/whatsapp/ConversationLog';

export default function WhatsAppAgent() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Bot className="h-6 w-6 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">WhatsApp AI Agent</h1>
              <p className="text-sm text-zinc-400">
                Intelligent booking assistant & business intelligence
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-zinc-500">Powered by</span>
              <span className="text-xs font-semibold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                ZAINA AI
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="simulator" className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
            <TabsTrigger
              value="simulator"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Live Simulator
            </TabsTrigger>
            <TabsTrigger
              value="conversations"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
            >
              <Bot className="h-4 w-4 mr-2" />
              Conversations
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="simulator" className="mt-0">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Simulator */}
              <div className="lg:col-span-1">
                <div className="h-[600px]">
                  <ChatSimulator />
                </div>
              </div>

              {/* Info Panel */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    🧪 Test Your AI Agent
                  </h3>
                  <div className="space-y-4 text-sm text-zinc-400">
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h4 className="text-amber-400 font-medium mb-2">
                        📱 Customer Mode
                      </h4>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Book appointments in English or Arabic</li>
                        <li>Ask about services and prices</li>
                        <li>Cancel or reschedule bookings</li>
                        <li>Send voice messages (coming soon)</li>
                      </ul>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h4 className="text-amber-400 font-medium mb-2">
                        👔 Admin Mode
                      </h4>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>"What was the revenue today?"</li>
                        <li>"Show me this week's sales"</li>
                        <li>"Who are our top customers?"</li>
                        <li>"What's the most popular service?"</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl border border-amber-500/20 p-6">
                  <h3 className="text-lg font-semibold text-amber-400 mb-2">
                    🌐 Bilingual Support
                  </h3>
                  <p className="text-sm text-zinc-400">
                    ZAINA automatically detects Arabic and English, responding in the same language.
                    Perfect for the Kuwaiti market! 🇰🇼
                  </p>
                  <div className="mt-3 flex gap-2">
                    <span className="px-2 py-1 bg-zinc-800 rounded text-xs">English</span>
                    <span className="px-2 py-1 bg-zinc-800 rounded text-xs" dir="rtl">العربية</span>
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
