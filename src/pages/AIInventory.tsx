import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { askClaude } from '@/lib/claude';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package, Sparkles, Send, RefreshCw, Zap, AlertTriangle, TrendingDown, ShoppingCart } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

function useInventoryContext(tenantId?: string) {
  return useQuery({
    queryKey: ['ai-inv-ctx', tenantId],
    queryFn: async () => {
      const [products, movements, suppliers, bookings] = await Promise.all([
        supabase.from('products').select('id,name,current_stock,reorder_point,cost_price,retail_price,usage_unit,category_id').order('current_stock'),
        supabase.from('inventory_transactions').select('product_id,quantity_change,transaction_type,created_at').gte('created_at', subDays(new Date(),30).toISOString()),
        supabase.from('suppliers').select('id,name,contact_person,phone,email'),
        supabase.from('bookings').select('service_category').in('status',['planned','confirmed']).gte('booking_date', format(new Date(),'yyyy-MM-dd')).lte('booking_date', format(subDays(new Date(),-7),'yyyy-MM-dd')),
      ]);

      const usage: Record<string,number> = {};
      (movements.data||[]).forEach(m => {
        if (m.transaction_type === 'service_consumption') usage[m.product_id] = (usage[m.product_id]||0) + Math.abs(m.quantity_change);
      });

      const enriched = (products.data||[]).map(p => ({
        id: p.id,
        name: p.name,
        current_stock: p.current_stock,
        reorder_point: p.reorder_point,
        cost_price: p.cost_price,
        unit: p.usage_unit,
        monthlyUsage: usage[p.id]||0,
        daysLeft: (usage[p.id]||0) > 0 ? Math.round(((p.current_stock||0) / (usage[p.id]/30)) ) : 999,
        isLow: (p.current_stock||0) <= (p.reorder_point||0),
        stockValue: (p.current_stock||0) * Number(p.cost_price||0),
      }));

      const lowStock = enriched.filter(p => p.isLow);
      const criticalStock = enriched.filter(p => (p.current_stock||0) === 0);
      const upcomingDemand = (bookings.data||[]).reduce((acc: Record<string,number>, b) => {
        acc[b.service_category] = (acc[b.service_category]||0)+1; return acc;
      }, {});

      return { products: enriched, lowStock, criticalStock, suppliers: suppliers.data||[], upcomingDemand, total: enriched.length };
    },
    enabled: !!tenantId,
  });
}

interface AIMsg { role: 'user'|'assistant'; content: string; ts: Date; }

async function askClaudeInventory(q: string, ctx: any, hist: AIMsg[], currency: string): Promise<string> {
  const system = `You are ZAINA AI, an inventory management expert for a Kuwait ladies salon.
You analyze stock levels, predict shortages, and generate purchase order recommendations.
Respond in the user's language (Arabic or English). Be specific and actionable.
Currency: ${currency}. Today: ${format(new Date(), 'EEEE, MMMM d, yyyy')}.

INVENTORY CONTEXT:
Total products: ${ctx?.total}
Low stock items (${ctx?.lowStock?.length}): ${JSON.stringify(ctx?.lowStock?.slice(0,10).map((p:any)=>({name:p.name,stock:p.current_stock,reorder:p.reorder_point,usage30d:p.monthlyUsage})) || [])}
Out of stock (${ctx?.criticalStock?.length}): ${JSON.stringify(ctx?.criticalStock?.map((p:any)=>p.name) || [])}
Suppliers: ${JSON.stringify(ctx?.suppliers?.map((s:any)=>s.name) || [])}
Upcoming demand by category: ${JSON.stringify(ctx?.upcomingDemand || {})}

When generating a PO, list items clearly with quantities and estimated costs.`;

  return askClaude({
    system,
    messages: [...hist.slice(-6).map(m => ({role: m.role, content: m.content})), {role:'user', content:q}],
  });
}

export default function AIInventory() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const { data: ctx, isLoading } = useInventoryContext(tenant?.id);
  const [messages, setMessages] = useState<AIMsg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const quickPrompts = ar ? [
    'ما المنتجات التي تحتاج إعادة طلب؟',
    'أنشئي طلب شراء للمنتجات الشحيحة',
    'كم يكفي المخزون الحالي من الأيام؟',
    'ما المنتجات الأكثر استخداماً هذا الشهر؟',
  ] : [
    'Which products need to be reordered now?',
    'Generate a purchase order for low stock items',
    'How many days of stock do we have left?',
    'What are the most consumed products this month?',
  ];

  const send = async (text: string) => {
    if (!text.trim() || thinking || !ctx) return;
    const um: AIMsg = { role:'user', content:text, ts:new Date() };
    setMessages(prev => [...prev, um]);
    setInput('');
    setThinking(true);
    try {
      const reply = await askClaudeInventory(text, ctx, [...messages, um], currency);
      setMessages(prev => [...prev, { role:'assistant', content:reply, ts:new Date() }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role:'assistant', content: err?.message || (ar ? 'حدث خطأ. حاولي مرة أخرى.' : 'An error occurred. Please try again.'), ts:new Date() }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">{ar ? 'مساعد المخزون الذكي' : 'AI Inventory Assistant'}</p>
            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/25 rounded-full"><Sparkles className="h-2.5 w-2.5 mr-0.5" />Claude</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{fontFamily:'Bricolage Grotesque,sans-serif'}}>{ar ? 'مساعد المخزون' : 'AI Inventory'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{ar ? 'توقع النقص وأنشئ طلبات الشراء تلقائياً' : 'Predict shortages and auto-generate purchase orders'}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setMessages([])}><RefreshCw className="h-3.5 w-3.5" />{ar ? 'محادثة جديدة' : 'New chat'}</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          {isLoading ? (<><Skeleton className="h-40 rounded-xl"/><Skeleton className="h-48 rounded-xl"/></>) : ctx ? (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: ar?'إجمالي المنتجات':'Total Products', val: ctx.total, color:'text-primary' },
                  { label: ar?'مخزون شحيح':'Low Stock', val: ctx.lowStock.length, color:'text-amber-500' },
                  { label: ar?'نفذ المخزون':'Out of Stock', val: ctx.criticalStock.length, color:'text-red-500' },
                  { label: ar?'الموردون':'Suppliers', val: ctx.suppliers.length, color:'text-primary' },
                ].map(({ label, val, color }) => (
                  <Card key={label} className="border"><CardContent className="p-3">
                    <p className="stat-number text-xl font-bold">{val}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </CardContent></Card>
                ))}
              </div>

              {/* Critical / Low stock list */}
              {ctx.lowStock.length > 0 && (
                <Card className="border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500"/>
                      <CardTitle className="text-sm">{ar?'يحتاج إعادة طلب':'Needs Reorder'}</CardTitle>
                      <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">{ctx.lowStock.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {ctx.lowStock.slice(0,7).map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-muted-foreground">{p.current_stock} {p.unit||''} {ar?'متبقي':'left'} · {ar?'إعادة طلب عند':'reorder at'} {p.reorder_point}</p>
                        </div>
                        <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-full font-semibold',
                          p.current_stock === 0
                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
                        )}>
                          {p.current_stock === 0 ? (ar?'نفذ':'Empty') : (ar?'شحيح':'Low')}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Top used */}
              <Card className="border">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-primary"/>
                    <CardTitle className="text-sm">{ar?'الأكثر استخداماً (30 يوم)':'Most Used (30 days)'}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {[...ctx.products].sort((a,b)=>b.monthlyUsage-a.monthlyUsage).slice(0,5).map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[140px]">{p.name}</span>
                      <span className="font-semibold">{p.monthlyUsage} {p.unit||''}</span>
                    </div>
                  ))}
                  {ctx.products.every(p => p.monthlyUsage === 0) && (
                    <p className="text-xs text-muted-foreground">{ar?'لا توجد بيانات استخدام بعد':'No usage data yet'}</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* AI Chat */}
        <div className="lg:col-span-2">
          <Card className="border h-full flex flex-col" style={{minHeight:'520px'}}>
            <CardHeader className="pb-3 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <ShoppingCart className="h-3.5 w-3.5 text-white"/>
                </div>
                <div>
                  <CardTitle className="text-sm">{ar?'ZAINA — مساعد المخزون':'ZAINA — Inventory AI'}</CardTitle>
                  <CardDescription className="text-xs">{ar?'إدارة المخزون وطلبات الشراء بالذكاء الاصطناعي':'AI-powered stock management and purchase order generation'}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{minHeight:0}}>
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center gap-4 py-8">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Package className="h-7 w-7 text-primary"/>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-sm">{ar?'مساعد المخزون الذكي':'AI Inventory Assistant'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ar?'اسأليني عن المخزون وطلبات الشراء':'Ask me about stock levels and purchase orders'}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                    {quickPrompts.map(p => (
                      <button key={p} onClick={() => send(p)} className="text-left text-xs px-3 py-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground" dir={ar?'rtl':'ltr'}>{p}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m,i) => (
                <div key={i} className={cn('flex', m.role==='user'?'justify-end':'justify-start')}>
                  {m.role==='assistant' && <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center mr-2 mt-1 flex-shrink-0"><ShoppingCart className="h-3 w-3 text-primary"/></div>}
                  <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm', m.role==='user'?'bg-primary text-primary-foreground rounded-br-sm':'bg-muted text-foreground rounded-bl-sm border border-border/50')} dir={/[\u0600-\u06FF]/.test(m.content)?'rtl':'ltr'}>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    <p className={cn('text-[10px] mt-1 opacity-50', m.role==='user'?'text-right':'text-left')}>{format(m.ts,'HH:mm')}</p>
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1"><ShoppingCart className="h-3 w-3 text-primary"/></div>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 border border-border/50"><div className="flex gap-1">{[0,1,2].map(i=><span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{animationDelay:`${i*150}ms`}}/>)}</div></div>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex-shrink-0">
              <div className="flex gap-2">
                <Textarea value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder={ar?'اسأل عن المخزون، طلبات الشراء، التوقعات...':'Ask about stock, purchase orders, demand forecasting...'}
                  rows={1} className="flex-1 resize-none text-sm min-h-[36px] max-h-[100px]" dir={ar?'rtl':'ltr'}/>
                <Button onClick={() => send(input)} disabled={!input.trim()||thinking||!ctx} size="icon" className="h-9 w-9 flex-shrink-0"><Send className="h-3.5 w-3.5"/></Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
