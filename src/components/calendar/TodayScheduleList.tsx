import { Appointment, AppointmentStatus, Staff, Service } from '@/types/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, ChevronRight, UserX, CheckCircle2, Zap, UserPlus, AlertTriangle, Phone } from 'lucide-react';
import { isToday, isBefore } from 'date-fns';
import { format } from 'date-fns';

interface Props {
  appointments: Appointment[];
  staff: Staff[];
  services: Service[];
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  onAppointmentClick: (apt: Appointment) => void;
  date: Date;
}

// The next logical status for one-tap advancement
const NEXT_STATUS: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  planned:    'confirmed',
  confirmed:  'checked_in',
  checked_in: 'in_service',
  in_service: 'completed',
};

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; dot: string }> = {
  planned:    { label: 'Planned',   color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',          dot: 'bg-slate-400' },
  confirmed:  { label: 'Confirmed', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',               dot: 'bg-blue-500' },
  checked_in: { label: 'Arrived',   color: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',       dot: 'bg-violet-500' },
  in_service: { label: 'In Chair',  color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',   dot: 'bg-emerald-500 animate-pulse' },
  completed:  { label: 'Done',      color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',  dot: 'bg-emerald-600' },
  cancelled:  { label: 'Cancelled', color: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300',                  dot: 'bg-red-500' },
  no_show:    { label: 'No-Show',   color: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',       dot: 'bg-orange-500' },
};

const ADVANCE_LABEL: Partial<Record<AppointmentStatus, string>> = {
  planned:    'Confirm',
  confirmed:  'Check In',
  checked_in: 'Start',
  in_service: '✓ Done',
};

export function TodayScheduleList({ appointments, staff, services, onStatusChange, onAppointmentClick, date }: Props) {
  const now = new Date();
  const sorted = [...appointments].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const isOverdue = (apt: Appointment) => {
    if (!isToday(date)) return false;
    if (!['planned', 'confirmed'].includes(apt.status)) return false;
    const [h, m] = apt.startTime.split(':').map(Number);
    const t = new Date(date); t.setHours(h, m + 15, 0, 0);
    return isBefore(t, now);
  };

  const isNow = (apt: Appointment) => {
    const [sh, sm] = apt.startTime.split(':').map(Number);
    const [eh, em] = apt.endTime.split(':').map(Number);
    const start = new Date(date); start.setHours(sh, sm, 0, 0);
    const end   = new Date(date); end.setHours(eh, em, 0, 0);
    return isBefore(start, now) && isBefore(now, end);
  };

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm font-medium">No appointments today</p>
        <p className="text-xs opacity-60 mt-1">Walk-ins welcome!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Today's Schedule · {sorted.length} appointments
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((apt, idx) => {
          const member = staff.find(s => s.id === apt.staffId);
          const cfg    = STATUS_CONFIG[apt.status];
          const next   = NEXT_STATUS[apt.status];
          const overdue = isOverdue(apt);
          const active  = isNow(apt) && apt.status === 'in_service';
          const prev = idx > 0 ? sorted[idx - 1] : null;
          const showHour = !prev || prev.startTime.split(':')[0] !== apt.startTime.split(':')[0];

          return (
            <div key={apt.id}>
              {showHour && (
                <div className="px-3 py-1 bg-muted/20 border-b border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    {parseInt(apt.startTime) < 12 ? apt.startTime.split(':')[0] + ':00 AM' : apt.startTime.split(':')[0] + ':00 PM'}
                  </p>
                </div>
              )}

              <div
                className={cn(
                  'flex items-center gap-3 px-3 py-3 border-b border-border/40 cursor-pointer hover:bg-muted/30 transition-colors',
                  active && 'bg-emerald-50/60 dark:bg-emerald-950/20',
                  overdue && 'bg-orange-50/60 dark:bg-orange-950/20',
                  apt.status === 'completed' && 'opacity-60',
                  apt.status === 'cancelled' && 'opacity-40',
                )}
                onClick={() => onAppointmentClick(apt)}
              >
                {/* Time + status dot */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0 w-12 text-center">
                  <span className="text-xs font-bold tabular-nums">{apt.startTime}</span>
                  <div className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                </div>

                {/* Staff avatar */}
                {member && (
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{ background: member.color }}
                    title={member.name}
                  >
                    {member.name[0]}
                  </div>
                )}

                {/* Client + service */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('text-xs font-semibold truncate', overdue && 'text-orange-700 dark:text-orange-400')}>
                      {overdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                      {apt.clientName}
                    </p>
                    {apt.status === 'no_show' && <UserX className="h-3 w-3 text-orange-500 flex-shrink-0" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{apt.serviceName} · {apt.duration}min</p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {/* No-show button — for overdue or confirmed appointments */}
                  {overdue && apt.status !== 'no_show' && apt.status !== 'cancelled' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatusChange(apt.id, 'no_show')}
                      className="h-6 text-[10px] px-1.5 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                      title="Mark as no-show"
                    >
                      <UserX className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Advance status */}
                  {next && !overdue && apt.status !== 'cancelled' && (
                    <Button
                      size="sm"
                      onClick={() => onStatusChange(apt.id, next)}
                      className={cn(
                        'h-6 text-[10px] px-2 font-semibold',
                        next === 'completed' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                      )}
                      variant={next === 'completed' ? 'default' : 'outline'}
                    >
                      {ADVANCE_LABEL[apt.status]}
                    </Button>
                  )}

                  {/* Overdue: show both Check-In and No-Show */}
                  {overdue && next && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatusChange(apt.id, next)}
                      className="h-6 text-[10px] px-1.5 border-primary/40 text-primary hover:bg-primary/5"
                    >
                      {ADVANCE_LABEL[apt.status]}
                    </Button>
                  )}

                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
              </div>
            </div>
          );
        })}
        <div className="h-4" />
      </div>
    </div>
  );
}
