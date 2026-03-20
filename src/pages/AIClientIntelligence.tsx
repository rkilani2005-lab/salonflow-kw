import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, Sparkles, Send, RefreshCw, Zap, Heart,
  TrendingDown, Star, Crown, AlertCircle, MessageCircle,
} from 'lucide-react';
import { format, subDays, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

function useClientIntelData(tenantId?: string) {
  return useQuery({
    queryKey: ['ai-client-intel', tenantId],
    queryFn: async () => {
      const cutoff = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      const [clients, recentBookings, transactions] = await Promise.all([
        supabase.from('clients').select('id,name,phone,tier,created_at,notes').order('created_at', { ascending: false }),
        supabase.from('bookings').select('client_id,booking_date,service_name,status').gte('booking_date', cutoff).in('status', ['completed','in_service']),
        supabase.from('transactions').select('client_id,grand_total,created_at').eq('status', 'completed').gte('created_at', subDays(new Date(), 90).toISOString()),
      ]);

      const clientMap: Record<string, { visits: number; lastVisit: string | null; spend: number; name: string; phone: string; tier: string }> = {};
      (clients.data || []).forEach(c => {
        clientMap[c.id] = { visits: 0, lastVisit: null, spend: 0, name: c.name, phone: c.phone, tier: c.tier };
      });
      (recentBookings.data || []).forEach(b => {
        if (b.client_id && clientMap[b.client_id]) {
          clientMap[b.client_id].visits++;
          if (!clientMap[b.client_id].lastVisit || b.booking_date > clientMap[b.client_id].lastVisit!) {
            clientMap[b.client_id].lastVisit = b.booking_date;
          }
        }
      });
      (transactions.data || []).forEach(t => {
        if (t.client_id && clientMap[t.client_id]) {
          clientMap[t.client_id].spend += Number(t.grand_total);
        }
      });

      const enriched = Object.entries(clientMap).map(([id, d]) => ({
        id, ...d,
        daysSinceVisit: d.lastVisit ? differenceInDays(new Date(), new Date(d.lastVisit)) : 999,
        spend: Math.round(d.spend * 1000) / 1000,
      }));

      const atRisk = enriched.filter(c => c.daysSinceVisit > 30 && c.daysSinceVisit < 90 && c.visits > 0)
        .sort((a,b) => a.daysSinceVisit - b.daysSinceVisit).slice(0, 8);
      const churned = enriched.filter(c => c.daysSinceVisit >= 90 && c.visits > 0)
        .sort((a,b) => b.spend - a.spend).slice(0, 5);
      const vip = enriched.filter(c => c.tier === 'vvip' || c.tier === 'vip').slice(0, 6);
      const topSpenders = enriched.sort((a,b) => b.spend - a.spend).slice(0, 5);

      return { enriched, atRisk, churned, vip, topSpenders, total: enriched.length };
    },
    enabled: !!tenantId,
  });
}

interface AIMsg { role: 'user' | 'assistant'; content: string; ts: Date; }

import { askClaude } from '@/lib/claude';

async function askClaudeClients(q: string, context: any, history: AIMsg[], currency: string): Promise<string> {
  const system = `You are ZAINA AI, a client intelligence expert for a Kuwait ladies salon.
You analyze client behavior, predict churn, and suggest personalized re-engagement messages.
Respond in the same language as the user (Arabic or English). Be specific with client names when available.
Currency: ${currency}. Today: ${format(new Date(), 'EEEE, MMMM d, yyyy')}.

CLIENT DATA SUMMARY:
Total clients: ${context?.total}
At-risk clients (30-90 days since last visit): ${JSON.stringify(context?.atRisk?.slice(0,8) || [])}
Churned clients (90+ days): ${JSON.stringify(context?.churned?.slice(0,5) || [])}
VIP/VVIP clients: ${JSON.stringify(context?.vip?.slice(0,6) || [])}
Top spenders (90d): ${JSON.stringify(context?.topSpenders?.slice(0,5) || [])}

When asked to write a WhatsApp message, write it naturally in the appropriate language with emojis.`;

  return askClaude({
    system,
    messages: [
      ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: q },
    ],
  });
}

export default function AIClientIntelligence() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const { data: intel, isLoading } = useClientIntelData(tenant?.id);
  const [messages, setMessages] = useState<AIMsg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const quickPrompts = ar ? [
    'من العميلات المعرضات لخطر الفقدان؟',
    'اكتبي رسالة واتساب لإعادة عميلة لم تزرنا منذ شهر',
    'من أكثر العميلات إنفاقاً هذا الشهر؟',
    'اقترحي حملة لإعادة العميلات المنقطعات',
  ] : [
    'Which clients are at risk of churning?',
    'Write a WhatsApp re-engagement message for a lost client',
    'Who are our top spenders this month?',
    'Suggest a campaign to win back lapsed clients',
  ];

  const send = async (text: string) => {
    if (!text.trim() || thinking || !intel) return;
    const um: AIMsg = { role: 'user', content: text, ts: new Date() };
    setMessages(prev => [...prev, um]);
    setInput('');
    setThinking(true);
    try {
      const reply = await askClaudeClients(text, intel, [...messages, um], currency);
      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: new Date() }]);
    } catch (err: any) {
      const msg = err?.message || (ar ? 'حدث خطأ. حاولي مرة أخرى.' : 'An error occurred. Please try again.');
      setMessages(prev => [...prev, { role: 'assistant', content: msg, ts: new Date() }]);
    } finally {
      setThinking(false);
    }
  };

  const riskColor = (days: number) => {
    if (days > 60) return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300';
    if (days > 45) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300';
    return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300';
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
              {ar ? 'ذكاء العميلات' : 'Client Intelligence'}
            </p>
            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/25 rounded-full">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />Claude
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            {ar ? 'ذكاء العميلات' : 'Client Intelligence'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ar ? 'توقع الانقطاع واقتراح رسائل التفاعل الشخصية' : 'Predict churn & generate personalised re-engagement messages'}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setMessages([])}>
          <RefreshCw className="h-3.5 w-3.5" />
          {ar ? 'محادثة جديدة' : 'New chat'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Insight cards */}
        <div className="space-y-4">
          {isLoading ? (
            <><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></>
          ) : intel ? (
            <>
              {/* At risk */}
              <Card className="border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-sm">{ar ? 'عميلات في خطر' : 'At-Risk Clients'}</CardTitle>
                    <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">{intel.atRisk.length}</Badge>
                  </div>
                  <CardDescription className="text-xs">{ar ? 'لم يزرن منذ 30-90 يوم' : '30–90 days since last visit'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {intel.atRisk.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-muted-foreground">{c.visits} {ar ? 'زيارة' : 'visits'} · {c.spend.toFixed(3)} {currency}</p>
                      </div>
                      <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-full font-semibold', riskColor(c.daysSinceVisit))}>
                        {c.daysSinceVisit}d
                      </Badge>
                    </div>
                  ))}
                  {intel.atRisk.length > 5 && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1">+{intel.atRisk.length - 5} {ar ? 'أكثر' : 'more'}</p>
                  )}
                </CardContent>
              </Card>

              {/* VIP */}
              <Card className="border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-sm">{ar ? 'عميلات VIP/VVIP' : 'VIP / VVIP Clients'}</CardTitle>
                    <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">{intel.vip.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {intel.vip.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30">
                      <div className="h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-[10px] flex-shrink-0">
                        {c.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-muted-foreground">{c.spend.toFixed(3)} {currency}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 uppercase">
                        {c.tier}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: ar ? 'إجمالي العميلات' : 'Total Clients', val: intel.total, icon: Users, color: 'text-primary' },
                  { label: ar ? 'في خطر' : 'At Risk', val: intel.atRisk.length, icon: AlertCircle, color: 'text-amber-500' },
                  { label: ar ? 'منقطعات' : 'Churned', val: intel.churned.length, icon: TrendingDown, color: 'text-red-500' },
                  { label: ar ? 'VIP' : 'VIP+', val: intel.vip.length, icon: Star, color: 'text-amber-500' },
                ].map(({ label, val, icon: Icon, color }) => (
                  <Card key={label} className="border">
                    <CardContent className="p-3">
                      <Icon className={cn('h-4 w-4 mb-1', color)} />
                      <p className="stat-number text-lg font-bold">{val}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {/* AI Chat */}
        <div className="lg:col-span-2">
          <Card className="border h-full flex flex-col" style={{ minHeight: '520px' }}>
            <CardHeader className="pb-3 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <Heart className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm">{ar ? 'ZAINA — ذكاء العميلات' : 'ZAINA — Client Intelligence AI'}</CardTitle>
                  <CardDescription className="text-xs">{ar ? 'توقع الانقطاع وكتابة رسائل التفاعل' : 'Predict churn · write re-engagement messages · identify VIPs'}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center gap-4 py-8">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-sm">{ar ? 'ذكاء العميلات' : 'Client Intelligence'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ar ? 'اسأليني عن عميلاتك وأساعدك في الاحتفاظ بهن' : 'Ask me about your clients and I\'ll help you retain them'}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                    {quickPrompts.map(p => (
                      <button key={p} onClick={() => send(p)}
                        className="text-left text-xs px-3 py-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                        dir={ar ? 'rtl' : 'ltr'}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {m.role === 'assistant' && (
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                      <Heart className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm',
                    m.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm border border-border/50'
                  )} dir={/[\u0600-\u06FF]/.test(m.content) ? 'rtl' : 'ltr'}>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    <p className={cn('text-[10px] mt-1 opacity-50', m.role === 'user' ? 'text-right' : 'text-left')}>{format(m.ts, 'HH:mm')}</p>
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Heart className="h-3 w-3 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 border border-border/50">
                    <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{animationDelay:`${i*150}ms`}}/>)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex-shrink-0">
              <div className="flex gap-2">
                <Textarea value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder={ar ? 'اسأل عن العميلات، الانقطاع، رسائل التفاعل...' : 'Ask about clients, churn risk, re-engagement messages...'}
                  rows={1} className="flex-1 resize-none text-sm min-h-[36px] max-h-[100px]" dir={ar ? 'rtl' : 'ltr'} />
                <Button onClick={() => send(input)} disabled={!input.trim() || thinking || !intel} size="icon" className="h-9 w-9 flex-shrink-0">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
