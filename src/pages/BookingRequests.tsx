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
  RefreshCw, User, AlertCircle, Inbox, Loader2,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface BookingRequest {
  id: string;
  booking_id: string;
  tenant_id: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  status: 'pending' | 'approved' | 'declined';
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

function useOnlineRequests(tenantId?: string, statusFilter = 'pending') {
  return useQuery({
    queryKey: ['online-booking-requests', tenantId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('online_booking_requests')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BookingRequest[];
    },
    enabled: !!tenantId,
    refetchInterval: 30_000, // poll every 30s
  });
}

export default function BookingRequests() {
  const { tenant, profile } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const ar = language === 'ar';

  const [statusFilter, setStatusFilter]   = useState('pending');
  const [actionOpen,   setActionOpen]     = useState(false);
  const [actionTarget, setActionTarget]   = useState<BookingRequest | null>(null);
  const [actionType,   setActionType]     = useState<'approve' | 'decline'>('approve');
  const [adminNote,    setAdminNote]      = useState('');
  const [saving,       setSaving]         = useState(false);

  const { data: requests = [], isLoading, refetch } = useOnlineRequests(tenant?.id, statusFilter);

  const pending  = requests.filter(r => r.status === 'pending').length;

  const openAction = (req: BookingRequest, type: 'approve' | 'decline') => {
    setActionTarget(req);
    setActionType(type);
    setAdminNote('');
    setActionOpen(true);
  };

  const handleAction = async () => {
    if (!actionTarget || !profile) return;
    setSaving(true);
    try {
      const newStatus = actionType === 'approve' ? 'approved' : 'declined';

      // Update the request record
      await supabase.from('online_booking_requests').update({
        status:      newStatus,
        admin_note:  adminNote || null,
        reviewed_by: profile.user_id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', actionTarget.id);

      // Update the booking status
      const bookingStatus = actionType === 'approve' ? 'confirmed' : 'cancelled';
      await supabase.from('bookings').update({
        status: bookingStatus,
        notes:  actionType === 'approve'
          ? `✅ Confirmed by ${profile.full_name || 'staff'}${adminNote ? ` — ${adminNote}` : ''}`
          : `❌ Declined by ${profile.full_name || 'staff'}${adminNote ? ` — ${adminNote}` : ''}`,
      }).eq('id', actionTarget.booking_id);

      qc.invalidateQueries({ queryKey: ['online-booking-requests'] });
      qc.invalidateQueries({ queryKey: ['bookings-calendar'] });

      toast({
        title: actionType === 'approve'
          ? `✅ Booking confirmed for ${actionTarget.client_name}`
          : `❌ Booking declined for ${actionTarget.client_name}`,
      });
      setActionOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const STATUS_CFG = {
    pending:  { label: 'Pending',  color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400' },
    approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' },
    declined: { label: 'Declined', color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400' },
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {ar ? 'المواعيد' : 'Appointments'}
          </p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily: 'Syne,sans-serif', letterSpacing: '-0.04em' }}>
            {ar ? 'طلبات الحجز الإلكتروني' : 'Online Booking Requests'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ar ? 'مراجعة وتأكيد طلبات الحجز من الإنترنت' : 'Review and confirm appointment requests from online booking'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5"/>{ar ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: ar ? 'في الانتظار' : 'Pending',  val: requests.filter(r => r.status === 'pending').length,  color: 'text-amber-600',   icon: Clock },
          { label: ar ? 'تم التأكيد' : 'Confirmed', val: requests.filter(r => r.status === 'approved').length, color: 'text-emerald-600', icon: CheckCircle2 },
          { label: ar ? 'مرفوض' : 'Declined',       val: requests.filter(r => r.status === 'declined').length, color: 'text-red-500',     icon: XCircle },
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

      {/* Status filter */}
      <div className="flex gap-1.5">
        {['pending', 'approved', 'declined', 'all'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('h-7 px-3 rounded-sm text-xs font-semibold border transition-all capitalize',
              statusFilter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/40')}>
            {s === 'pending' ? (ar ? 'في الانتظار' : 'Pending') :
             s === 'approved' ? (ar ? 'مؤكد' : 'Confirmed') :
             s === 'declined' ? (ar ? 'مرفوض' : 'Declined') :
             (ar ? 'الكل' : 'All')}
            {s === 'pending' && pending > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold px-1">
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Request list */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-24 rounded-md"/>)}</div>
      ) : requests.length === 0 ? (
        <div className="border border-dashed rounded-md p-16 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-3 opacity-25"/>
          <p className="font-semibold">
            {statusFilter === 'pending'
              ? (ar ? 'لا توجد طلبات في الانتظار 🎉' : 'No pending requests 🎉')
              : (ar ? 'لا توجد طلبات' : 'No requests')}
          </p>
          <p className="text-xs mt-1 opacity-60">
            {statusFilter === 'pending' && (ar ? 'كل طلبات الحجز تمت مراجعتها' : 'All booking requests have been reviewed')}
          </p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden divide-y divide-border">
          {requests.map(req => {
            const cfg = STATUS_CFG[req.status];
            const isPending = req.status === 'pending';
            return (
              <div key={req.id} className={cn(
                'px-5 py-4 bg-card hover:bg-muted/10 transition-colors',
                isPending && 'border-l-2 border-l-amber-400'
              )}>
                <div className="flex items-start gap-4">
                  {/* Client avatar */}
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
                        <Badge className="text-[9px] h-4 px-1.5 rounded-sm bg-amber-500 text-white border-0 animate-pulse">
                          ⏳ Awaiting review
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3"/>{req.client_phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Scissors className="h-3 w-3"/>{req.service_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3"/>
                        {format(parseISO(req.booking_date), 'EEE, MMM d yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3"/>{req.start_time.slice(0, 5)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      Requested {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                      {req.reviewed_at && ` · Reviewed ${formatDistanceToNow(new Date(req.reviewed_at), { addSuffix: true })}`}
                    </p>
                    {req.admin_note && (
                      <p className="text-[11px] text-muted-foreground italic mt-1">
                        Note: {req.admin_note}
                      </p>
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

      {/* Confirm / Decline dialog */}
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
            <div className="space-y-4 py-2">
              {/* Summary */}
              <div className="p-3 rounded-md bg-muted/40 space-y-1.5 text-sm">
                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground"/><strong>{actionTarget.client_name}</strong></div>
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground"/>{actionTarget.client_phone}</div>
                <div className="flex items-center gap-2"><Scissors className="h-3.5 w-3.5 text-muted-foreground"/>{actionTarget.service_name}</div>
                <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground"/>
                  {format(parseISO(actionTarget.booking_date), 'EEEE, MMM d yyyy')} at {actionTarget.start_time.slice(0,5)}
                </div>
              </div>

              {/* Confirmation message */}
              <div className={cn('p-3 rounded-md text-sm',
                actionType === 'approve'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400')}>
                {actionType === 'approve'
                  ? (ar ? 'سيتم تأكيد الحجز وإضافته للتقويم.' : 'The booking will be confirmed and added to the calendar.')
                  : (ar ? 'سيتم إلغاء الحجز ولن يظهر في التقويم.' : 'The booking will be cancelled and removed from the calendar.')}
              </div>

              {/* Optional note */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  {ar ? 'ملاحظة (اختياري)' : 'Note (optional)'}
                </label>
                <Textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  placeholder={actionType === 'approve'
                    ? (ar ? 'مثال: يرجى الحضور قبل 10 دقائق' : 'e.g. Please arrive 10 minutes early')
                    : (ar ? 'مثال: الوقت غير متاح، يرجى إعادة الحجز' : 'e.g. Time slot unavailable, please rebook')}
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
              className={cn('gap-1.5 min-w-[110px]',
                actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-destructive hover:bg-destructive/90')}>
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
