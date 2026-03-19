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
  Calendar, Clock, Zap, TrendingUp, AlertTriangle,
  CheckCircle2, Sparkles, Send, RefreshCw, Users,
} from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

function useSchedulingContext(tenantId?: string) {
  return useQuery({
    queryKey: ['ai-scheduling-ctx', tenantId],
    queryFn: async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      const [upcomingBookings, staff, services] = await Promise.all([
        supabase.from('bookings')
          .select('id,booking_date,start_time,end_time,status,service_name,staff_id,staff:staff_id(name),client_name')
          .gte('booking_date', todayStr)
          .lte('booking_date', in7)
          .in('status', ['planned','confirmed','in_service'])
          .order('booking_date').order('start_time'),
        supabase.from('staff').select('id,name,working_hours_start,working_hours_end,is_active').eq('is_active', true),
        supabase.from('services').select('id,name,duration,price').order('name'),
      ]);

      return {
        bookings: upcomingBookings.data || [],
        staff: staff.data || [],
        services: services.data || [],
      };
    },
    enabled: !!tenantId,
  });
}

interface AIMessage { role: 'user' | 'assistant'; content: string; ts: Date; }

async function askClaudeScheduling(
  question: string,
  context: any,
  history: AIMessage[],
  currency: string
): Promise<string> {
  const systemPrompt = `You are ZAINA AI, an expert scheduling assistant for a ladies salon in Kuwait.
You have access to the salon's upcoming bookings, staff roster, and service catalog.
Respond concisely and actionably. Use bullet points and emojis for readability.
Always suggest specific times (e.g. "Tuesday 2:00 PM with Fatima").
Detect if the user writes in Arabic and respond in Arabic.
Currency: ${currency}. Format KWD amounts as "X.XXX KWD".

CURRENT DATA:
Upcoming bookings (next 7 days): ${JSON.stringify(context?.bookings?.slice(0,30) || [])}
Active staff: ${JSON.stringify(context?.staff || [])}
Services: ${JSON.stringify(context?.services?.slice(0,20) || [])}
Today: ${format(new Date(), 'EEEE, MMMM d, yyyy')}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: question },
      ],
    }),
  });

  const data = await response.json();
  return data.content?.[0]?.text || 'Sorry, I could not process that.';
}

function StaffGapCard({ bookings, staff }: { bookings: any[]; staff: any[] }) {
  const { language } = useLanguage();
  const ar = language === 'ar';

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayBookings = bookings.filter(b => b.booking_date === today);
  const busyStaffIds = new Set(todayBookings.map(b => b.staff_id).filter(Boolean));
  const freeStaff = staff.filter(s => !busyStaffIds.has(s.id));

  return (
    <Card className="border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">{ar ? 'حالة الموظفات اليوم' : "Staff Status Today"}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {staff.slice(0, 6).map(s => {
          const busy = busyStaffIds.has(s.id);
          const appts = todayBookings.filter(b => b.staff_id === s.id);
          return (
            <div key={s.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', busy ? 'bg-amber-500' : 'bg-emerald-500')} />
                <span className="font-medium">{s.name}</span>
              </div>
              <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5 rounded-full',
                busy ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
                     : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
              )}>
                {busy ? `${appts.length} ${ar ? 'مواعيد' : 'appts'}` : ar ? 'متاحة' : 'Free'}
              </Badge>
            </div>
          );
        })}
        {freeStaff.length > 0 && (
          <p className="text-[10px] text-muted-foreground pt-1">
            💡 {freeStaff.length} {ar ? 'موظفة متاحة لمواعيد جديدة' : 'staff available for new bookings'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingGaps({ bookings }: { bookings: any[] }) {
  const { language } = useLanguage();
  const ar = language === 'ar';

  // Find days with < 3 bookings in next 7 days
  const dayCounts: Record<string, number> = {};
  bookings.forEach(b => {
    dayCounts[b.booking_date] = (dayCounts[b.booking_date] || 0) + 1;
  });
  const quietDays = Array.from({ length: 7 }, (_, i) => {
    const d = format(addDays(new Date(), i + 1), 'yyyy-MM-dd');
    return { date: d, count: dayCounts[d] || 0 };
  }).filter(d => d.count < 4);

  return (
    <Card className="border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm">{ar ? 'أيام هادئة — ملء الفجوات' : 'Quiet Days — Fill Gaps'}</CardTitle>
        </div>
        <CardDescription className="text-xs">{ar ? 'أيام بأقل من 4 مواعيد' : 'Days with fewer than 4 bookings'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {quietDays.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {ar ? 'الأسبوع القادم محجوز بشكل جيد!' : 'Next week looks well-booked!'}
          </div>
        ) : quietDays.map(d => (
          <div key={d.date} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40">
            <span className="font-medium">{format(new Date(d.date), 'EEE, MMM d')}</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{d.count} {ar ? 'مواعيد' : 'bookings'}</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300">
                {ar ? 'فرصة' : 'Gap'}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AIScheduling() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const { data: ctx, isLoading: ctxLoading } = useSchedulingContext(tenant?.id);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const quickPrompts = ar ? [
    'ما هي الفجوات في جدول هذا الأسبوع؟',
    'اقترحي أفضل وقت لحجز عميلة جديدة',
    'من هي أكثر موظفة انشغالاً اليوم؟',
    'كيف يمكنني تحسين الجدول هذا الأسبوع؟',
  ] : [
    'What are the scheduling gaps this week?',
    'Suggest the best slot for a new client tomorrow',
    'Which staff member is most overloaded today?',
    'How can I optimize the schedule this week?',
  ];

  const send = async (text: string) => {
    if (!text.trim() || thinking || !ctx) return;
    const userMsg: AIMessage = { role: 'user', content: text, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setThinking(true);
    try {
      const reply = await askClaudeScheduling(text, ctx, [...messages, userMsg], currency);
      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: new Date() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: ar ? 'عذراً، حدث خطأ. حاولي مرة أخرى.' : 'Sorry, something went wrong. Please try again.',
        ts: new Date(),
      }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
              {ar ? 'مساعد الجدولة الذكي' : 'AI Scheduling Assistant'}
            </p>
            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/25 rounded-full">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />Claude
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            {ar ? 'الجدولة الذكية' : 'Smart Scheduling'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ar ? 'اسألي الذكاء الاصطناعي عن أفضل المواعيد ومعالجة الفجوات' : 'Ask AI about optimal slots, gaps, and staff availability'}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setMessages([])}>
          <RefreshCw className="h-3.5 w-3.5" />
          {ar ? 'محادثة جديدة' : 'New chat'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left sidebar: context cards */}
        <div className="space-y-4">
          {ctxLoading ? (
            <><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></>
          ) : ctx ? (
            <>
              <StaffGapCard bookings={ctx.bookings} staff={ctx.staff} />
              <UpcomingGaps bookings={ctx.bookings} />
              {/* Today's load */}
              <Card className="border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">{ar ? 'مواعيد اليوم' : "Today's Load"}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {ctx.bookings
                    .filter(b => b.booking_date === format(new Date(), 'yyyy-MM-dd'))
                    .slice(0, 5)
                    .map((b, i) => (
                      <div key={b.id} className="flex items-center gap-2 text-xs py-1.5 border-b last:border-0 border-border/40">
                        <span className="text-primary font-bold min-w-[36px]">{b.start_time?.slice(0,5)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{b.client_name}</p>
                          <p className="text-muted-foreground truncate">{b.service_name}</p>
                        </div>
                      </div>
                    ))}
                  {ctx.bookings.filter(b => b.booking_date === format(new Date(), 'yyyy-MM-dd')).length === 0 && (
                    <p className="text-xs text-muted-foreground">{ar ? 'لا مواعيد اليوم' : 'No bookings today'}</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* AI Chat */}
        <div className="lg:col-span-2">
          <Card className="border h-full flex flex-col" style={{ minHeight: '520px' }}>
            <CardHeader className="pb-3 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm">{ar ? 'ZAINA — مساعد الجدولة' : 'ZAINA — Scheduling AI'}</CardTitle>
                  <CardDescription className="text-xs">{ar ? 'اسألي أي شيء عن الجدول والمواعيد' : 'Ask anything about your schedule and appointments'}</CardDescription>
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center gap-4 py-8">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-7 w-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-sm">{ar ? 'مساعد الجدولة الذكي' : 'AI Scheduling Assistant'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ar ? 'اسأليني عن المواعيد والفجوات في الجدول' : 'Ask me about appointments, gaps, and optimization'}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                    {quickPrompts.map(p => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="text-left text-xs px-3 py-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                        dir={ar ? 'rtl' : 'ltr'}
                      >
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
                      <Zap className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm border border-border/50'
                  )} dir={/[\u0600-\u06FF]/.test(m.content) ? 'rtl' : 'ltr'}>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    <p className={cn('text-[10px] mt-1 opacity-50', m.role === 'user' ? 'text-right' : 'text-left')}>
                      {format(m.ts, 'HH:mm')}
                    </p>
                  </div>
                </div>
              ))}

              {thinking && (
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Zap className="h-3 w-3 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 border border-border/50">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t flex-shrink-0">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder={ar ? 'اسأل عن الجدول، المواعيد، الفجوات...' : 'Ask about the schedule, slots, gaps...'}
                  rows={1}
                  className="flex-1 resize-none text-sm min-h-[36px] max-h-[100px]"
                  dir={ar ? 'rtl' : 'ltr'}
                />
                <Button onClick={() => send(input)} disabled={!input.trim() || thinking || !ctx} size="icon" className="h-9 w-9 flex-shrink-0">
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
