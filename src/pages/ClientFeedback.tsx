import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useToast } from '@/hooks/use-toast';
import { useStaff } from '@/hooks/useStaff';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Star, MessageSquare, TrendingUp, Users, Plus, Loader2,
  ThumbsUp, ThumbsDown, Download,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { exportCSV } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';

interface Feedback {
  id: string;
  client_name: string;
  client_phone: string | null;
  rating: number;
  comment: string | null;
  service_name: string | null;
  source: string;
  created_at: string;
  staff?: { name: string } | null;
}

function StarRating({ value, onChange, size = 'md' }: {
  value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' | 'lg';
}) {
  const [hover, setHover] = useState(0);
  const sz = size === 'lg' ? 'h-8 w-8' : size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button"
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}>
          <Star className={cn(sz, 'transition-colors',
            i <= (hover || value)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-muted text-muted-foreground/30'
          )}/>
        </button>
      ))}
    </div>
  );
}

function useFeedback(tenantId?: string, staffFilter?: string) {
  return useQuery({
    queryKey: ['feedback', tenantId, staffFilter],
    queryFn: async () => {
      let q = supabase
        .from('client_feedback')
        .select('*, staff:staff_id(name)')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (staffFilter && staffFilter !== 'all') q = q.eq('staff_id', staffFilter);
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

  const [staffFilter, setStaffFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);

  const { data: feedbackList = [], isLoading } = useFeedback(tenant?.id, staffFilter === 'all' ? undefined : staffFilter);
  const { data: staffList = [] } = useStaff();

  // Form state
  const [fClientName,  setFClientName]  = useState('');
  const [fPhone,       setFPhone]       = useState('');
  const [fRating,      setFRating]      = useState(5);
  const [fComment,     setFComment]     = useState('');
  const [fService,     setFService]     = useState('');
  const [fStaff,       setFStaff]       = useState('');
  const [saving,       setSaving]       = useState(false);

  // Filter
  const filtered = feedbackList.filter(f => {
    if (ratingFilter === 'all') return true;
    if (ratingFilter === 'positive') return f.rating >= 4;
    if (ratingFilter === 'neutral')  return f.rating === 3;
    if (ratingFilter === 'negative') return f.rating <= 2;
    return true;
  });

  // KPIs
  const avg     = feedbackList.length ? feedbackList.reduce((s,f) => s + f.rating, 0) / feedbackList.length : 0;
  const pos     = feedbackList.filter(f => f.rating >= 4).length;
  const neg     = feedbackList.filter(f => f.rating <= 2).length;
  const nps     = feedbackList.length ? Math.round(((pos - neg) / feedbackList.length) * 100) : 0;

  // Distribution
  const dist = [5,4,3,2,1].map(r => ({
    stars: r,
    count: feedbackList.filter(f => f.rating === r).length,
    pct:   feedbackList.length ? Math.round((feedbackList.filter(f => f.rating === r).length / feedbackList.length) * 100) : 0,
  }));

  const handleAdd = async () => {
    if (!fClientName || !fRating) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('client_feedback').insert({
        tenant_id:   tenant!.id,
        client_name: fClientName,
        client_phone: fPhone || null,
        rating:      fRating,
        comment:     fComment || null,
        service_name: fService || null,
        staff_id:    fStaff || null,
        source:      'manual',
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['feedback'] });
      toast({ title: '✅ Feedback recorded' });
      setAddOpen(false);
      setFClientName(''); setFPhone(''); setFRating(5); setFComment(''); setFService(''); setFStaff('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleExport = () => {
    exportCSV(
      feedbackList.map(f => ({
        date: format(parseISO(f.created_at),'yyyy-MM-dd'),
        client: f.client_name, phone: f.client_phone || '',
        rating: f.rating, comment: f.comment || '',
        service: f.service_name || '', staff: (f.staff as any)?.name || '', source: f.source,
      })),
      'client_feedback',
      { date:'Date', client:'Client', phone:'Phone', rating:'Rating', comment:'Comment', service:'Service', staff:'Staff', source:'Source' }
    );
  };

  const ratingColor = (r: number) =>
    r >= 4 ? 'text-emerald-600' : r === 3 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {ar ? 'العميلات' : 'Clients'}
          </p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.04em' }}>
            {ar ? 'التقييمات والآراء' : 'Client Feedback'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ar ? 'آراء وتقييمات العميلات بعد كل زيارة' : 'Ratings and reviews from your clients'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5"/>CSV
          </Button>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5"/>{ar ? 'إضافة تقييم' : 'Add Review'}
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: ar ? 'إجمالي التقييمات' : 'Total Reviews', val: feedbackList.length, icon: MessageSquare, color: 'text-primary' },
          { label: ar ? 'متوسط التقييم' : 'Avg Rating', val: avg.toFixed(1) + ' ★', icon: Star, color: 'text-amber-500' },
          { label: ar ? 'تقييمات إيجابية' : 'Positive (4-5★)', val: `${pos} (${feedbackList.length ? Math.round(pos/feedbackList.length*100) : 0}%)`, icon: ThumbsUp, color: 'text-emerald-600' },
          { label: 'NPS', val: nps, icon: TrendingUp, color: nps >= 0 ? 'text-emerald-600' : 'text-red-500' },
        ].map(({ label, val, icon: Icon, color }) => (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rating distribution */}
        <Card className="border">
          <CardContent className="p-4 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              {ar ? 'توزيع التقييمات' : 'Rating Distribution'}
            </p>
            {dist.map(({ stars, count, pct }) => (
              <div key={stars} className="flex items-center gap-2">
                <span className="text-xs font-semibold w-4 text-right text-amber-500">{stars}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 flex-shrink-0"/>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                </div>
                <span className="text-[11px] text-muted-foreground w-8 text-right">{count}</span>
              </div>
            ))}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{ar ? 'المتوسط' : 'Average'}</p>
                <StarRating value={Math.round(avg)} size="sm"/>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters + list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All staff"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? 'كل الموظفات' : 'All Staff'}</SelectItem>
                {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {['all','positive','neutral','negative'].map(f => (
              <button key={f} onClick={() => setRatingFilter(f)}
                className={cn('h-7 px-3 rounded-sm text-xs font-semibold border transition-all capitalize',
                  ratingFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40')}>
                {f === 'all' ? (ar ? 'الكل' : 'All') :
                 f === 'positive' ? '4-5 ★' :
                 f === 'neutral'  ? '3 ★'   : '1-2 ★'}
              </button>
            ))}
          </div>

          {isLoading ? (
            <LoadingState variant="rows" rows={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Star}
              size="compact"
              title={ar ? 'لا توجد تقييمات' : 'No reviews yet'}
              description={ar ? 'أضف أول تقييم يدوياً أو شارك رابط التقييم مع العميلات' : 'Add a review manually or share the feedback link with clients.'}
            />
          ) : (
            <div className="border rounded-md overflow-hidden divide-y divide-border">
              {filtered.map(f => (
                <div key={f.id} className="flex items-start gap-4 px-4 py-3.5 bg-card hover:bg-muted/20 transition-colors">
                  {/* Rating badge */}
                  <div className={cn('h-9 w-9 rounded-sm flex items-center justify-center flex-shrink-0 font-black text-base stat-number',
                    f.rating >= 4 ? 'bg-emerald-50 dark:bg-emerald-950/30' :
                    f.rating === 3 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-red-50 dark:bg-red-950/20',
                    ratingColor(f.rating)
                  )}>
                    {f.rating}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold">{f.client_name}</p>
                      <StarRating value={f.rating} size="sm"/>
                      {f.service_name && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-sm">{f.service_name}</Badge>
                      )}
                    </div>
                    {f.comment && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.comment}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                      {(f.staff as any)?.name ? ` · ${(f.staff as any).name}` : ''}
                      {f.source !== 'manual' ? ` · via ${f.source}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Review dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400"/>
              {ar ? 'إضافة تقييم يدوي' : 'Add Manual Review'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'التقييم *' : 'Rating *'}</Label>
              <StarRating value={fRating} onChange={setFRating} size="lg"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'اسم العميلة *' : 'Client Name *'}</Label>
                <Input value={fClientName} onChange={e => setFClientName(e.target.value)} className="h-9"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'الهاتف' : 'Phone'}</Label>
                <Input value={fPhone} onChange={e => setFPhone(e.target.value)} className="h-9" placeholder="+965..."/>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'الخدمة' : 'Service'}</Label>
              <Input value={fService} onChange={e => setFService(e.target.value)} className="h-9" placeholder={ar ? 'اختياري' : 'Optional'}/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'الموظفة' : 'Staff'}</Label>
              <Select value={fStaff} onValueChange={setFStaff}>
                <SelectTrigger className="h-9"><SelectValue placeholder={ar ? 'اختياري' : 'Optional'}/></SelectTrigger>
                <SelectContent>
                  {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'التعليق' : 'Comment'}</Label>
              <Textarea value={fComment} onChange={e => setFComment(e.target.value)} rows={3} className="resize-none text-sm" placeholder={ar ? 'اختياري' : 'Optional'}/>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving || !fClientName} className="gap-1.5 min-w-[110px]">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Star className="h-3.5 w-3.5"/>}
              {ar ? 'حفظ التقييم' : 'Save Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
