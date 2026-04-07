import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Calendar, Clock, Phone, Scissors, CheckCircle2, XCircle,
  RefreshCw, User, Inbox, Loader2,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// A booking request is simply an online booking that is 'planned' (awaiting confirmation)
// or has already been actioned (confirmed / cancelled).
// We read DIRECTLY from the bookings table — no extra table required.
interface BookingRequest {
  id: string;               // booking id
  client_name: string;
  client_phone: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  status: string;           // planned | confirmed | cancelled
  notes: string | null;
  created_at: string;
  is_online_booking: boolean;
}

// Map booking status → display status for the admin inbox
function displayStatus(b: BookingRequest): 'pending' | 'approved' | 'declined' {
  if (b.status === 'confirmed') return 'approved';
  if (b.status === 'cancelled') return 'declined';
  return 'pending';
}

function useOnlineRequests(tenantId?: string, statusFilter = 'pending') {
  return useQuery({
    queryKey: ['online-booking-requests', tenantId, statusFilter],
    queryFn: async () => {
      // Query the bookings table directly — is_online_booking = true
      let q = supabase
        .from('bookings')
        .select('id, client_name, client_phone, service_name, booking_date, start_time, status, notes, created_at, is_online_booking')
        .eq('is_online_booking', true)
        .order('created_at', { ascending: false });

      // Filter by display status
      if (statusFilter === 'pending')  q = q.eq('status', 'planned');
      if (statusFilter === 'approved') q = q.eq('status', 'confirmed');
      if (statusFilter === 'declined') q = q.eq('status', 'cancelled');
      // 'all' → no status filter, but still only online bookings

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BookingRequest[];
    },
    enabled: !!tenantId,
    refetchInterval: 20_000,  // poll every 20 seconds
  });
}

export default function BookingRequests() {
  const { tenant, profile } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const ar = language === 'ar';

  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionOpen,   setActionOpen]   = useState(false);
  const [actionTarget, setActionTarget] = useState<BookingRequest | null>(null);
  const [actionType,   setActionType]   = useState<'approve' | 'decline'>('approve');
  const [adminNote,    setAdminNote]    = useState('');
  const [saving,       setSaving]       = useState(false);

  const { data: requests = [], isLoading, error: queryError, refetch } =
    useOnlineRequests(tenant?.id, statusFilter);

  const pending = (() => {
    // Always show live pending count regardless of current filter
    return useOnlineRequests(tenant?.id, 'pending').data?.length ?? 0;
  })();

  const STATUS_CFG = {
    pending:  { label: ar ? 'في الانتظار' : 'Pending',   color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400' },
    approved: { label: ar ? 'مؤكد'        : 'Confirmed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' },
    declined: { label: ar ? 'مرفوض'       : 'Declined',  color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400' },
  };

  const openAction = (req: BookingRequest, type: 'approve' | 'decline') => {
    setActionTarget(req);
    setActionType(type);
    setAdminNote('');
    setActionOpen(true);
  };

  const handleAction = async () => {
    if (!actionTarget) return;
    setSaving(true);
    try {
      const newStatus = actionType === 'approve' ? 'confirmed' : 'cancelled';
      const staffName = profile?.full_name || 'staff';
      const noteText  = actionType === 'approve'
        ? `✅ Confirmed by ${staffName}${adminNote ? ` — ${adminNote}` : ''}`
        : `❌ Declined by ${staffName}${adminNote ? ` — ${adminNote}` : ''}`;

      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus, notes: noteText })
        .eq('id', actionTarget.id);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['online-booking-requests'] });
      qc.invalidateQueries({ queryKey: ['bookings-calendar'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['today-appointments'] });

      toast({
        title: actionType === 'approve'
          ? `✅ Confirmed for ${actionTarget.client_name}`
          : `Booking declined for ${actionTarget.client_name}`,
      });
      setActionOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // Count pending directly from current data
  const pendingCount  = requests.filter(r => r.status === 'planned').length;
  const approvedCount = requests.filter(r => r.status === 'confirmed').length;
  const declinedCount = requests.filter(r => r.status === 'cancelled').length;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {ar ? 'المواعيد' : 'Appointments'}
          </p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily:'Syne,sans-serif', letterSpacing:'-0.04em' }}>
            {ar ? 'طلبات الحجز الإلكتروني' : 'Online Booking Requests'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ar ? 'مراجعة وتأكيد الحجوزات القادمة من الموقع' : 'Review and confirm appointments from online booking'}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5"/>{ar ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* Error state — table might not exist yet */}
      {queryError && (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {ar ? 'خطأ في تحميل الطلبات:' : 'Error loading requests:'} {(queryError as any).message}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: ar ? 'في الانتظار' : 'Pending',   val: statusFilter === 'all' ? pendingCount  : (statusFilter === 'pending'  ? requests.length : 0) || pendingCount,  color: 'text-amber-600',   icon: Clock },
          { label: ar ? 'تم التأكيد' : 'Confirmed',  val: statusFilter === 'all' ? approvedCount : (statusFilter === 'approved' ? requests.length : 0), color: 'text-emerald-600', icon: CheckCircle2 },
          { label: ar ? 'مرفوض'      : 'Declined',   val: statusFilter === 'all' ? declinedCount : (statusFilter === 'declined' ? requests.length : 0), color: 'text-red-500',     icon: XCircle },
        ].map(({ label, val, color, icon: Icon }) => (
          <Card key={label} className="border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <Icon className={cn('h-4 w-4', color)}/>
              </div>
              <p className={cn('stat-number text-2xl font-black', color)}>{val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {(['pending', 'approved', 'declined', 'all'] as const).map(s => {
          const labels = {
            pending:  ar ? 'في الانتظار' : 'Pending',
            approved: ar ? 'مؤكد'        : 'Confirmed',
            declined: ar ? 'مرفوض'       : 'Declined',
            all:      ar ? 'الكل'         : 'All',
          };
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn(
                'h-7 px-3 rounded-sm text-xs font-semibold border transition-all flex items-center gap-1.5',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              )}>
              {labels[s]}
              {s === 'pending' && pendingCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold px-1">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-24 rounded-md"/>)}</div>
      ) : requests.length === 0 ? (
        <div className="border border-dashed rounded-md p-16 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-3 opacity-25"/>
          <p className="font-semibold text-sm">
            {statusFilter === 'pending'
              ? (ar ? 'لا توجد طلبات في الانتظار 🎉' : 'No pending requests 🎉')
              : (ar ? 'لا توجد طلبات' : 'No requests found')}
          </p>
          {statusFilter === 'pending' && (
            <p className="text-xs mt-1 opacity-60">
              {ar ? 'ستظهر الحجوزات الجديدة هنا تلقائياً' : 'New online bookings will appear here automatically'}
            </p>
          )}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden divide-y divide-border">
          {requests.map(req => {
            const ds  = displayStatus(req);
            const cfg = STATUS_CFG[ds];
            const isPending = ds === 'pending';
            return (
              <div key={req.id}
                className={cn(
                  'px-5 py-4 bg-card hover:bg-muted/10 transition-colors',
                  isPending && 'border-l-2 border-l-amber-400'
                )}>
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className={cn(
                    'h-10 w-10 rounded-md flex items-center justify-center text-sm font-black flex-shrink-0',
                    isPending ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700' : 'bg-muted text-muted-foreground'
                  )}>
                    {req.client_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold">{req.client_name}</p>
                      <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-sm font-bold border', cfg.color)}>
                        {cfg.label}
                      </Badge>
                      {isPending && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-sm border border-amber-200 dark:border-amber-800 animate-pulse">
                          ⏳ {ar ? 'بانتظار المراجعة' : 'Awaiting review'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{req.client_phone}</span>
                      <span className="flex items-center gap-1"><Scissors className="h-3 w-3"/>{req.service_name}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3"/>
                        {format(parseISO(req.booking_date), 'EEE, MMM d yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3"/>{req.start_time.slice(0, 5)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {ar ? 'طُلب' : 'Requested'} {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                    </p>
                    {req.notes && !req.notes.startsWith('⏳') && (
                      <p className="text-[11px] text-muted-foreground italic mt-0.5">{req.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {isPending && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline"
                        className="h-8 gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400 dark:hover:bg-red-950/30"
                        onClick={() => openAction(req, 'decline')}>
                        <XCircle className="h-3.5 w-3.5"/>
                        {ar ? 'رفض' : 'Decline'}
                      </Button>
                      <Button size="sm"
                        className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => openAction(req, 'approve')}>
                        <CheckCircle2 className="h-3.5 w-3.5"/>
                        {ar ? 'تأكيد' : 'Confirm'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={cn('text-base flex items-center gap-2',
              actionType === 'approve' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {actionType === 'approve'
                ? <><CheckCircle2 className="h-4 w-4"/>{ar ? 'تأكيد الحجز' : 'Confirm Booking'}</>
                : <><XCircle className="h-4 w-4"/>{ar ? 'رفض الحجز' : 'Decline Booking'}</>}
            </DialogTitle>
          </DialogHeader>
          {actionTarget && (
            <div className="space-y-4 py-1">
              <div className="p-3 rounded-md bg-muted/40 space-y-1.5 text-sm">
                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground"/><strong>{actionTarget.client_name}</strong></div>
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground"/>{actionTarget.client_phone}</div>
                <div className="flex items-center gap-2"><Scissors className="h-3.5 w-3.5 text-muted-foreground"/>{actionTarget.service_name}</div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground"/>
                  {format(parseISO(actionTarget.booking_date), 'EEEE, MMM d yyyy')} {ar ? 'الساعة' : 'at'} {actionTarget.start_time.slice(0, 5)}
                </div>
              </div>

              <div className={cn('p-3 rounded-md text-sm',
                actionType === 'approve'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400')}>
                {actionType === 'approve'
                  ? (ar ? 'سيتم تأكيد الموعد وسيظهر في التقويم.' : 'Booking will be confirmed and appear in the calendar.')
                  : (ar ? 'سيتم إلغاء الموعد.' : 'Booking will be cancelled.')}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  {ar ? 'ملاحظة (اختياري)' : 'Note (optional)'}
                </label>
                <Textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  placeholder={actionType === 'approve'
                    ? (ar ? 'مثال: يرجى الحضور قبل 10 دقائق' : 'e.g. Please arrive 10 minutes early')
                    : (ar ? 'مثال: الوقت غير متاح' : 'e.g. Time slot unavailable')}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setActionOpen(false)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button size="sm" onClick={handleAction} disabled={saving}
              className={cn('gap-1.5 min-w-[100px]',
                actionType === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-destructive hover:bg-destructive/90')}>
              {saving
                ? <Loader2 className="h-3.5 w-3.5 animate-spin"/>
                : actionType === 'approve'
                  ? <><CheckCircle2 className="h-3.5 w-3.5"/>{ar ? 'تأكيد' : 'Confirm'}</>
                  : <><XCircle className="h-3.5 w-3.5"/>{ar ? 'رفض' : 'Decline'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
