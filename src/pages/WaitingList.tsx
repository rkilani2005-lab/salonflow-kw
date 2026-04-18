import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPhoneInput } from '@/lib/phoneUtils';
import { useStaff } from '@/hooks/useStaff';
import { useServicesManagement } from '@/hooks/useServices';
import { useClients } from '@/hooks/useClients';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AsyncSection } from '@/components/ui/state-primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock, Plus, Bell, CheckCircle2, XCircle, Users, Loader2,
  Phone, Scissors, Calendar, ArrowRight,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface WaitEntry {
  id: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  staff_id: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  status: string;
  notified_at: string | null;
  created_at: string;
  staff?: { name: string } | null;
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  waiting:  { label: 'Waiting',   color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400' },
  notified: { label: 'Notified',  color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400' },
  booked:   { label: 'Booked',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' },
  expired:  { label: 'Expired',   color: 'bg-muted text-muted-foreground border-border' },
  cancelled:{ label: 'Cancelled', color: 'bg-muted text-muted-foreground border-border' },
};

function useWaitingList(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['waiting-list', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waiting_list')
        .select('*, staff:staff_id(name)')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as WaitEntry[];
    },
    enabled: !!tenantId,
  });
}

export default function WaitingList() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const ar = language === 'ar';

  const [addOpen, setAddOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('waiting');

  const { data: entries = [], isLoading } = useWaitingList(tenant?.id);
  const { data: staffList = [] } = useStaff();
  const { data: services = [] } = useServicesManagement();
  const { data: clients = [] } = useClients();

  // Form
  const [clientName,  setClientName]  = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [serviceId,   setServiceId]   = useState('');
  const [staffId,     setStaffId]     = useState('');
  const [prefDate,    setPrefDate]    = useState('');
  const [prefTime,    setPrefTime]    = useState('');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);

  const selectedService = (services as any[]).find((s: any) => s.id === serviceId);

  const fillFromClient = (clientId: string) => {
    const c = (clients as any[]).find((cl: any) => cl.id === clientId);
    if (c) { setClientName(c.name); setClientPhone(c.phone); }
  };

  const handleAdd = async () => {
    if (!clientName || !clientPhone || !serviceId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('waiting_list').insert({
        tenant_id:     tenant!.id,
        client_name:   clientName,
        client_phone:  clientPhone,
        service_name:  selectedService?.name || '',
        service_id:    serviceId || null,
        staff_id:      staffId || null,
        preferred_date: prefDate || null,
        preferred_time: prefTime || null,
        notes:         notes || null,
        status:        'waiting',
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['waiting-list'] });
      toast({ title: '✅ Added to waiting list' });
      setAddOpen(false);
      setClientName(''); setClientPhone(''); setServiceId('');
      setStaffId(''); setPrefDate(''); setPrefTime(''); setNotes('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleNotify = async (id: string) => {
    await supabase.from('waiting_list')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('id', id);
    qc.invalidateQueries({ queryKey: ['waiting-list'] });
    toast({ title: '✅ Marked as notified' });
  };

  const handleCancel = async (id: string) => {
    await supabase.from('waiting_list').update({ status: 'cancelled' }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['waiting-list'] });
    toast({ title: 'Entry cancelled' });
  };

  const filtered = entries.filter(e =>
    statusFilter === 'all' ? true : e.status === statusFilter
  );

  const waitingCount  = entries.filter(e => e.status === 'waiting').length;
  const notifiedCount = entries.filter(e => e.status === 'notified').length;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {ar ? 'المواعيد' : 'Appointments'}
          </p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.04em' }}>
            {ar ? 'قائمة الانتظار' : 'Waiting List'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ar ? 'العميلات المنتظرات لموعد شاغر' : 'Clients waiting for an available appointment slot'}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-1.5 h-9">
          <Plus className="h-4 w-4"/>{ar ? 'إضافة للقائمة' : 'Add to List'}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: ar ? 'منتظرة' : 'Waiting',    val: waitingCount,                    color: 'text-amber-600',   icon: Clock },
          { label: ar ? 'تم التنبيه' : 'Notified', val: notifiedCount,                 color: 'text-blue-600',    icon: Bell },
          { label: ar ? 'تم الحجز' : 'Booked',    val: entries.filter(e=>e.status==='booked').length, color: 'text-emerald-600', icon: CheckCircle2 },
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
        {['all','waiting','notified','booked','cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('h-7 px-3 rounded-sm text-xs font-semibold border transition-all capitalize',
              statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40')}>
            {s === 'all' ? (ar ? 'الكل' : 'All') : STATUS_CFG[s]?.label || s}
          </button>
        ))}
      </div>

      {/* List */}
      <AsyncSection
        loading={isLoading}
        empty={filtered.length === 0}
        loadingVariant="rows"
        loadingRows={3}
        emptyState={{
          icon: Users,
          title: ar ? 'لا يوجد إدخالات' : 'No entries',
        }}
      >
        <div className="border rounded-md overflow-hidden divide-y divide-border">
          {filtered.map(entry => {
            const cfg = STATUS_CFG[entry.status] || STATUS_CFG.waiting;
            return (
              <div key={entry.id} className="flex items-start gap-4 px-5 py-4 bg-card hover:bg-muted/20 transition-colors">
                {/* Avatar */}
                <div className="h-9 w-9 rounded-sm bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-primary">
                    {entry.client_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold">{entry.client_name}</p>
                    <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-sm font-bold border', cfg.color)}>
                      {cfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{entry.client_phone}</span>
                    <span className="flex items-center gap-1"><Scissors className="h-3 w-3"/>{entry.service_name}</span>
                    {entry.staff?.name && <span className="flex items-center gap-1"><Users className="h-3 w-3"/>{entry.staff.name}</span>}
                    {entry.preferred_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3"/>
                        {format(parseISO(entry.preferred_date), 'MMM d')}
                        {entry.preferred_time ? ` at ${entry.preferred_time}` : ''}
                      </span>
                    )}
                  </div>
                  {entry.notes && <p className="text-[11px] text-muted-foreground/60 mt-0.5 italic">{entry.notes}</p>}
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    Added {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    {entry.notified_at ? ` · Notified ${formatDistanceToNow(new Date(entry.notified_at), { addSuffix: true })}` : ''}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 flex-shrink-0 mt-0.5">
                  {entry.status === 'waiting' && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                      onClick={() => handleNotify(entry.id)}>
                      <Bell className="h-3 w-3"/>Notify
                    </Button>
                  )}
                  {(entry.status === 'waiting' || entry.status === 'notified') && (
                    <Button size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/8"
                      onClick={() => handleCancel(entry.id)}>
                      <XCircle className="h-3.5 w-3.5"/>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AsyncSection>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary"/>
              {ar ? 'إضافة للقائمة' : 'Add to Waiting List'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Quick fill from existing client */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'عميلة موجودة' : 'Existing Client'}</Label>
              <Select onValueChange={fillFromClient}>
                <SelectTrigger className="h-9"><SelectValue placeholder={ar ? 'اختياري — ابحثي عن عميلة' : 'Optional — pick existing client'}/></SelectTrigger>
                <SelectContent>
                  {(clients as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'الاسم *' : 'Name *'}</Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} className="h-9" placeholder="Client name"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'الهاتف *' : 'Phone *'}</Label>
                <Input
                  value={clientPhone}
                  onFocus={() => { if (!clientPhone) setClientPhone('+965 '); }}
                  onChange={e => setClientPhone(formatPhoneInput(e.target.value))}
                  className="h-9 font-mono"
                  placeholder="+965 9XXX XXXX"
                  inputMode="numeric"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'الخدمة *' : 'Service *'}</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="h-9"><SelectValue placeholder={ar ? 'اختري الخدمة' : 'Select service'}/></SelectTrigger>
                <SelectContent>
                  {(services as any[]).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'الموظفة المفضلة' : 'Preferred Stylist'}</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="h-9"><SelectValue placeholder={ar ? 'أي موظفة' : 'Any stylist'}/></SelectTrigger>
                <SelectContent>
                  {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'التاريخ المفضل' : 'Preferred Date'}</Label>
                <Input type="date" value={prefDate} onChange={e => setPrefDate(e.target.value)} className="h-9"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? 'الوقت المفضل' : 'Preferred Time'}</Label>
                <Input type="time" value={prefTime} onChange={e => setPrefTime(e.target.value)} className="h-9"/>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none text-sm" placeholder={ar ? 'اختياري' : 'Optional'}/>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving || !clientName || !clientPhone || !serviceId} className="gap-1.5 min-w-[110px]">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Plus className="h-3.5 w-3.5"/>}
              {ar ? 'إضافة' : 'Add to List'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
