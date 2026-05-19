import { useMemo, useState } from 'react';
import { Appointment, AppointmentStatus } from '@/types/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, AlertTriangle, Clock, CheckCircle2, XCircle, UserX, Zap, Sparkles, Loader2, Send } from 'lucide-react';
import { isToday, isBefore } from 'date-fns';

interface Props {
  appointments: Appointment[];
  activeFilter: AppointmentStatus | 'all';
  onFilterChange: (f: AppointmentStatus | 'all') => void;
  onWalkIn: () => void;
  date: Date;
  onActionsApplied?: () => void;
}

interface StatusPill {
  status: AppointmentStatus | 'all';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgActive: string;
  alert?: boolean;
}

const PILLS: StatusPill[] = [
  { status: 'all', label: 'All', icon: Clock, color: 'text-foreground', bgActive: 'bg-muted border-border' },
  { status: 'planned', label: 'Planned', icon: Clock, color: 'text-muted-foreground', bgActive: 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600' },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-blue-600', bgActive: 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700' },
  { status: 'checked_in', label: 'Arrived', icon: UserPlus, color: 'text-violet-600', bgActive: 'bg-violet-50 border-violet-300 dark:bg-violet-950 dark:border-violet-700' },
  { status: 'in_service', label: 'In Chair', icon: Zap, color: 'text-emerald-600', bgActive: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-700' },
  { status: 'completed', label: 'Done', icon: CheckCircle2, color: 'text-emerald-700', bgActive: 'bg-emerald-100 border-emerald-400 dark:bg-emerald-900 dark:border-emerald-600' },
  { status: 'no_show', label: 'No-Show', icon: UserX, color: 'text-orange-600', bgActive: 'bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-700', alert: true },
  { status: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-500', bgActive: 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700' },
];

interface AIAction {
  type: 'shift_bookings' | 'mark_no_show' | 'cancel_booking' | 'send_message' | 'rebook_client';
  booking_ids?: string[]; booking_id?: string;
  delta_minutes?: number; reason?: string; text?: string;
  client_id?: string; suggested_date?: string; suggested_time?: string;
}

interface AIPlan {
  status: 'ok' | 'clarify' | 'unsupported';
  summary?: string; question?: string; reason?: string;
  actions?: AIAction[];
}

export function ReceptionCommandBar({ appointments, activeFilter, onFilterChange, onWalkIn, date, onActionsApplied }: Props) {
  const now = new Date();
  const { toast } = useToast();
  const { tenant } = useAuth();
  const [command, setCommand] = useState('');
  const [thinking, setThinking] = useState(false);
  const [plan, setPlan] = useState<AIPlan | null>(null);
  const [editableActions, setEditableActions] = useState<AIAction[]>([]);
  const [applying, setApplying] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: appointments.length };
    for (const a of appointments) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [appointments]);

  const overdueCount = useMemo(() => {
    if (!isToday(date)) return 0;
    return appointments.filter(a => {
      if (!['planned', 'confirmed'].includes(a.status)) return false;
      const [h, m] = a.startTime.split(':').map(Number);
      const apptTime = new Date(date);
      apptTime.setHours(h, m + 15, 0, 0);
      return isBefore(apptTime, now);
    }).length;
  }, [appointments, date, now]);

  async function runCommand() {
    if (!command.trim() || !tenant?.id) return;
    setThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('reception-command', {
        body: { command: command.trim(), date: date.toISOString().slice(0, 10) },
      });
      if (error) throw error;
      const p = data as AIPlan;
      setPlan(p);
      setEditableActions(p.actions ?? []);
    } catch (err: any) {
      toast({ title: 'AI command failed', description: err.message, variant: 'destructive' });
    } finally { setThinking(false); }
  }

  async function applyActions() {
    setApplying(true);
    let applied = 0; let failed = 0;
    for (const a of editableActions) {
      try {
        if (a.type === 'shift_bookings' && a.booking_ids?.length && a.delta_minutes !== undefined) {
          for (const id of a.booking_ids) {
            const { data: b } = await supabase.from('bookings').select('start_time').eq('id', id).single();
            if (!b?.start_time) { failed++; continue; }
            const [hh, mm] = b.start_time.split(':').map(Number);
            const minsTotal = hh * 60 + mm + a.delta_minutes;
            const newH = Math.floor(((minsTotal % (24*60)) + 24*60) % (24*60) / 60);
            const newM = ((minsTotal % 60) + 60) % 60;
            const newTime = `${String(newH).padStart(2,'0')}:${String(newM).padStart(2,'0')}:00`;
            const { error } = await supabase.from('bookings').update({ start_time: newTime }).eq('id', id);
            if (error) failed++; else applied++;
          }
        } else if (a.type === 'mark_no_show' && a.booking_id) {
          const { error } = await supabase.from('bookings').update({ status: 'no_show' }).eq('id', a.booking_id);
          if (error) failed++; else applied++;
        } else if (a.type === 'cancel_booking' && a.booking_id) {
          const { error } = await supabase.from('bookings').update({
            status: 'cancelled', cancellation_reason: a.reason ?? 'Reception command',
          }).eq('id', a.booking_id);
          if (error) failed++; else applied++;
        } else if (a.type === 'send_message' && a.booking_ids?.length && a.text) {
          for (const id of a.booking_ids) {
            const { data: bk } = await supabase.from('bookings').select('client:clients(phone)').eq('id', id).single();
            const phone = (bk as any)?.client?.phone;
            if (!phone) { failed++; continue; }
            const { error } = await supabase.functions.invoke('channel-send', { body: { channel: 'whatsapp', to: phone, text: a.text } });
            if (error) failed++; else applied++;
          }
        }
      } catch { failed++; }
    }
    setApplying(false);
    setPlan(null);
    setCommand('');
    setEditableActions([]);
    toast({
      title: failed ? `Applied ${applied}, failed ${failed}` : `Applied ${applied} actions`,
      variant: failed ? 'destructive' : 'default',
    });
    onActionsApplied?.();
  }

  return (
    <>
      <div className="border-b bg-card">
        <div className="flex items-center gap-2 px-4 py-2">
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
          <Input
            placeholder='Try: "shift all 3 PM bookings by 20 minutes and notify the clients"'
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !thinking && runCommand()}
            className="h-9 text-sm"
            disabled={thinking}
          />
          <Button size="sm" onClick={runCommand} disabled={thinking || !command.trim()} className="h-9 flex-shrink-0">
            {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="ml-1.5">Plan</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 border-t overflow-x-auto scrollbar-none">
          <Button size="sm" onClick={onWalkIn} className="h-8 gap-1.5 text-xs font-bold flex-shrink-0 shadow-sm">
            <UserPlus className="h-3.5 w-3.5" />Walk In
          </Button>

          <div className="h-5 w-px bg-border flex-shrink-0 mx-1" />

          {overdueCount > 0 && (
            <button onClick={() => onFilterChange('confirmed')} className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold border border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700 flex-shrink-0 animate-pulse">
              <AlertTriangle className="h-3.5 w-3.5" />{overdueCount} Overdue
            </button>
          )}

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {PILLS.map(pill => {
              const count = counts[pill.status] || 0;
              const isActive = activeFilter === pill.status;
              const Icon = pill.icon;
              if (pill.status !== 'all' && count === 0) return null;
              return (
                <button key={pill.status} onClick={() => onFilterChange(pill.status as any)} className={cn(
                  'flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-all duration-150 flex-shrink-0',
                  isActive ? cn(pill.bgActive, 'border-2') : 'bg-transparent border-border text-muted-foreground hover:bg-muted'
                )}>
                  <Icon className={cn('h-3 w-3', isActive ? pill.color : '')} />
                  <span>{pill.label}</span>
                  {count > 0 && (
                    <span className={cn('ml-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold px-1', isActive ? 'bg-current/15' : 'bg-muted')}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={!!plan} onOpenChange={(o) => { if (!o) { setPlan(null); setEditableActions([]); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI action plan</DialogTitle>
          </DialogHeader>
          {plan?.status === 'clarify' && (
            <div>
              <p className="text-sm">The AI needs clarification:</p>
              <p className="text-sm mt-2 p-3 bg-muted rounded">{plan.question}</p>
            </div>
          )}
          {plan?.status === 'unsupported' && (
            <div>
              <p className="text-sm text-muted-foreground">Not supported: {plan.reason}</p>
              <p className="text-xs text-muted-foreground mt-2">v1 actions: shift bookings, mark no-show, cancel booking, send WhatsApp message.</p>
            </div>
          )}
          {plan?.status === 'ok' && (
            <div className="space-y-3">
              <p className="text-sm">{plan.summary}</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {editableActions.map((a, i) => (
                  <div key={i} className="text-xs p-2 bg-muted rounded space-y-1">
                    <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                    {a.delta_minutes !== undefined && <span className="ml-2">delta: {a.delta_minutes}m</span>}
                    {a.booking_ids?.length && <span className="ml-2">{a.booking_ids.length} bookings</span>}
                    {a.text && (
                      <Textarea className="mt-1 text-xs min-h-[60px]" value={a.text} onChange={(e) => setEditableActions(prev => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPlan(null); setEditableActions([]); }}>Cancel</Button>
            {plan?.status === 'ok' && (
              <Button onClick={applyActions} disabled={applying || editableActions.length === 0}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}Apply
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
