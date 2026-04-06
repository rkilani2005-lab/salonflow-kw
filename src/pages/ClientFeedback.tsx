import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Star, MessageSquare, Plus, TrendingUp, ThumbsUp, ThumbsDown,
  Send, Copy, Check, Loader2, Filter, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface Feedback {
  id: string;
  client_name: string;
  client_phone: string | null;
  rating: number;
  comment: string | null;
  service_name: string | null;
  staff_name: string | null;
  channel: string;
  is_public: boolean;
  response_text: string | null;
  responded_at: string | null;
  created_at: string;
}

function StarRating({ rating, max = 5, size = 'sm' }: { rating: number; max?: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={cn(sz, i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}/>
      ))}
    </div>
  );
}

function useFeedback(tenantId?: string, ratingFilter?: string) {
  return useQuery({
    queryKey: ['feedback', tenantId, ratingFilter],
    queryFn: async () => {
      let q = supabase.from('client_feedback').select('*')
        .eq('tenant_id', tenantId!).order('created_at', { ascending: false });
      if (ratingFilter && ratingFilter !== 'all')
        q = q.eq('rating', Number(ratingFilter));
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Feedback[];
    },
    enabled: !!tenantId,
  });
}

export default function ClientFeedback() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const ar = language === 'ar';

  const [ratingFilter, setRatingFilter] = useState('all');
  const [addOpen,      setAddOpen]      = useState(false);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [responding,   setResponding]   = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [copied,       setCopied]       = useState(false);
  const [saving,       setSaving]       = useState(false);

  const { data: feedback = [], isLoading } = useFeedback(tenant?.id, ratingFilter);

  // KPIs
  const total    = feedback.length;
  const avgRating = total > 0 ? feedback.reduce((s, f) => s + f.rating, 0) / total : 0;
  const positive  = feedback.filter(f => f.rating >= 4).length;
  const negative  = feedback.filter(f => f.rating <= 2).length;
  const nps       = total > 0 ? Math.round(((positive - negative) / total) * 100) : 0;

  // Add manual feedback form
  const [form, setForm] = useState({
    client_name: '', client_phone: '', rating: 5,
    comment: '', service_name: '', staff_name: '', channel: 'manual',
  });

  const handleAdd = async () => {
    if (!form.client_name || !tenant?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('client_feedback').insert({
        tenant_id:    tenant.id,
        client_name:  form.client_name,
        client_phone: form.client_phone || null,
        rating:       form.rating,
        comment:      form.comment || null,
        service_name: form.service_name || null,
        staff_name:   form.staff_name || null,
        channel:      form.channel,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['feedback'] });
      toast({ title: '✅ Feedback recorded' });
      setAddOpen(false);
      setForm({ client_name:'', client_phone:'', rating:5, comment:'', service_name:'', staff_name:'', channel:'manual' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleRespond = async (id: string) => {
    if (!responseText.trim()) return;
    const { error } = await supabase.from('client_feedback').update({
      response_text: responseText,
      responded_at:  new Date().toISOString(),
    }).eq('id', id);
    if (!error) {
      qc.invalidateQueries({ queryKey: ['feedback'] });
      toast({ title: '✅ Response saved' });
      setResponding(null);
      setResponseText('');
    }
  };

  // Feedback link for tenant (share with clients)
  const feedbackUrl = `${window.location.origin}/feedback/${tenant?.id}`;
  const copyLink = () => {
    navigator.clipboard.writeText(feedbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ratingColor = (r: number) =>
    r >= 4 ? 'text-emerald-600' : r <= 2 ? 'text-red-500' : 'text-amber-600';

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {ar ? 'تجربة العميل' : 'Client Experience'}
          </p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily:'Syne,sans-serif', letterSpacing:'-0.04em' }}>
            {ar ? 'تقييمات العميلات' : 'Client Feedback'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ar ? 'تقييمات العميلات وردود الفعل بعد كل زيارة' : 'Post-visit ratings and client satisfaction'}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-1.5 h-9">
          <Plus className="h-4 w-4"/>{ar ? 'إضافة تقييم' : 'Add Feedback'}
        </Button>
      </div>

      {/* Feedback link */}
      <div className="flex items-center gap-3 p-4 rounded-md border bg-card">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold mb-0.5">{ar ? 'رابط التقييم' : 'Feedback Link'}</p>
          <p className="text-[11px] text-muted-foreground font-mono truncate">{feedbackUrl}</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 flex-shrink-0" onClick={copyLink}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500"/> : <Copy className="h-3.5 w-3.5"/>}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: ar ? 'إجمالي التقييمات' : 'Total Reviews',   val: total,                                     color: 'text-primary',     icon: MessageSquare },
          { label: ar ? 'متوسط التقييم' : 'Avg Rating',          val: avgRating.toFixed(1),                      color: 'text-amber-500',   icon: Star          },
          { label: ar ? 'إيجابية' : 'Positive (4-5★)',           val: `${positive} (${total?Math.round(positive/total*100):0}%)`, color:'text-emerald-600', icon: ThumbsUp },
          { label: ar ? 'NPS' : 'Satisfaction Score',            val: `${nps}%`,                                 color: nps>=70?'text-emerald-600':nps>=40?'text-amber-500':'text-red-500', icon: TrendingUp },
        ].map(({ label, val, color, icon: Icon }) => (
          <Card key={label} className="border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <Icon className={cn('h-4 w-4', color)}/>
              </div>
              <p className={cn('stat-number text-xl font-black', color)}>{val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rating filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all','5','4','3','2','1'].map(r => (
          <button key={r} onClick={() => setRatingFilter(r)}
            className={cn('h-7 px-3 rounded-sm text-xs font-semibold border transition-all flex items-center gap-1',
              ratingFilter === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40')}>
            {r === 'all' ? (ar ? 'الكل' : 'All') : (
              <><Star className="h-3 w-3 fill-amber-400 text-amber-400"/>{r}★</>
            )}
          </button>
        ))}
      </div>

      {/* Feedback list */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-24 rounded-md"/>)}</div>
      ) : feedback.length === 0 ? (
        <div className="border border-dashed rounded-md p-12 text-center text-muted-foreground">
          <Star className="h-8 w-8 mx-auto mb-2 opacity-30"/>
          <p className="text-sm font-medium">{ar ? 'لا توجد تقييمات بعد' : 'No feedback yet'}</p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden divide-y divide-border">
          {feedback.map(f => {
            const isExpanded = expanded === f.id;
            return (
              <div key={f.id} className="bg-card">
                <div className="flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  {/* Rating circle */}
                  <div className={cn('h-10 w-10 rounded-sm flex items-center justify-center text-lg font-black flex-shrink-0',
                    f.rating >= 4 ? 'bg-emerald-100 dark:bg-emerald-950/30' :
                    f.rating <= 2 ? 'bg-red-100 dark:bg-red-950/30' : 'bg-amber-100 dark:bg-amber-950/30',
                    ratingColor(f.rating))}>
                    {f.rating}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold">{f.client_name}</p>
                      <StarRating rating={f.rating}/>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-sm capitalize border-border text-muted-foreground">
                        {f.channel}
                      </Badge>
                      {f.response_text && (
                        <Badge className="text-[9px] h-4 px-1.5 rounded-sm bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
                          Responded
                        </Badge>
                      )}
                    </div>
                    {f.comment && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{f.comment}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/60">
                      {f.service_name && <span>{f.service_name}</span>}
                      {f.staff_name && <span>· {f.staff_name}</span>}
                      <span>· {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 flex-shrink-0">
                    {!f.response_text && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        onClick={() => { setResponding(f.id); setResponseText(''); }}>
                        <Send className="h-3 w-3"/>Reply
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => setExpanded(isExpanded ? null : f.id)}>
                      {isExpanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                    </Button>
                  </div>
                </div>

                {/* Expanded: full comment + response */}
                {isExpanded && (
                  <div className="px-5 pb-4 space-y-3 border-t bg-muted/10">
                    <div className="pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Comment</p>
                      <p className="text-sm">{f.comment || <span className="text-muted-foreground italic">No comment</span>}</p>
                    </div>
                    {f.response_text && (
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/15">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mb-1">Your Response</p>
                        <p className="text-sm">{f.response_text}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {f.responded_at ? format(parseISO(f.responded_at), 'MMM d, yyyy HH:mm') : ''}
                        </p>
                      </div>
                    )}
                    {responding === f.id && (
                      <div className="space-y-2">
                        <Textarea value={responseText} onChange={e => setResponseText(e.target.value)}
                          placeholder="Write your response..." rows={3} className="text-sm resize-none"/>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleRespond(f.id)} disabled={!responseText.trim()} className="gap-1.5">
                            <Send className="h-3.5 w-3.5"/>Send Response
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setResponding(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Feedback Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500"/>
              {ar ? 'إضافة تقييم يدوي' : 'Record Feedback Manually'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Client Name *</Label>
                <Input value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} className="h-9"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone</Label>
                <Input value={form.client_phone} onChange={e => setForm({...form, client_phone: e.target.value})} className="h-9"/>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rating *</Label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(r => (
                  <button key={r} onClick={() => setForm({...form, rating: r})}
                    className={cn('h-9 w-9 rounded-md border text-sm font-bold transition-all',
                      form.rating === r ? 'bg-amber-400 border-amber-400 text-white' : 'border-border text-muted-foreground hover:border-amber-300')}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Service</Label>
                <Input value={form.service_name} onChange={e => setForm({...form, service_name: e.target.value})} className="h-9" placeholder="Optional"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Stylist</Label>
                <Input value={form.staff_name} onChange={e => setForm({...form, staff_name: e.target.value})} className="h-9" placeholder="Optional"/>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Comment</Label>
              <Textarea value={form.comment} onChange={e => setForm({...form, comment: e.target.value})}
                rows={3} className="text-sm resize-none" placeholder="Client's feedback..."/>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Channel</Label>
              <Select value={form.channel} onValueChange={v => setForm({...form, channel: v})}>
                <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving || !form.client_name} className="gap-1.5 min-w-[110px]">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Star className="h-3.5 w-3.5"/>}
              {ar ? 'حفظ التقييم' : 'Save Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
