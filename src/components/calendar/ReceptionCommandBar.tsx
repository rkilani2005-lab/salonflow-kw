import { useMemo } from 'react';
import { Appointment, AppointmentStatus } from '@/types/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { UserPlus, AlertTriangle, Clock, CheckCircle2, XCircle, UserX, Zap } from 'lucide-react';
import { isToday, isBefore, parseISO } from 'date-fns';

interface Props {
  appointments: Appointment[];          // ALL today's appointments
  activeFilter: AppointmentStatus | 'all';
  onFilterChange: (f: AppointmentStatus | 'all') => void;
  onWalkIn: () => void;
  date: Date;
}

interface StatusPill {
  status: AppointmentStatus | 'all';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgActive: string;
  alert?: boolean;  // true = pulse ring for urgent attention
}

const PILLS: StatusPill[] = [
  { status: 'all',        label: 'All',        icon: Clock,        color: 'text-foreground',          bgActive: 'bg-muted border-border' },
  { status: 'planned',    label: 'Planned',    icon: Clock,        color: 'text-muted-foreground',    bgActive: 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600' },
  { status: 'confirmed',  label: 'Confirmed',  icon: CheckCircle2, color: 'text-blue-600',             bgActive: 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700' },
  { status: 'checked_in', label: 'Arrived',    icon: UserPlus,     color: 'text-violet-600',           bgActive: 'bg-violet-50 border-violet-300 dark:bg-violet-950 dark:border-violet-700' },
  { status: 'in_service', label: 'In Chair',   icon: Zap,          color: 'text-emerald-600',          bgActive: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-700' },
  { status: 'completed',  label: 'Done',       icon: CheckCircle2, color: 'text-emerald-700',          bgActive: 'bg-emerald-100 border-emerald-400 dark:bg-emerald-900 dark:border-emerald-600' },
  { status: 'no_show',    label: 'No-Show',    icon: UserX,        color: 'text-orange-600',           bgActive: 'bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-700', alert: true },
  { status: 'cancelled',  label: 'Cancelled',  icon: XCircle,      color: 'text-red-500',              bgActive: 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700' },
];

export function ReceptionCommandBar({ appointments, activeFilter, onFilterChange, onWalkIn, date }: Props) {
  const now = new Date();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: appointments.length };
    for (const a of appointments) {
      c[a.status] = (c[a.status] || 0) + 1;
    }
    return c;
  }, [appointments]);

  // Appointments that are confirmed/planned but their time has passed — no-show risk
  const overdueCount = useMemo(() => {
    if (!isToday(date)) return 0;
    return appointments.filter(a => {
      if (!['planned', 'confirmed'].includes(a.status)) return false;
      const [h, m] = a.startTime.split(':').map(Number);
      const apptTime = new Date(date);
      apptTime.setHours(h, m + 15, 0, 0); // 15-min grace
      return isBefore(apptTime, now);
    }).length;
  }, [appointments, date, now]);

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-card overflow-x-auto scrollbar-none">
      {/* Walk-In button — most prominent */}
      <Button
        size="sm"
        onClick={onWalkIn}
        className="h-8 gap-1.5 text-xs font-bold flex-shrink-0 shadow-sm"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Walk In
      </Button>

      <div className="h-5 w-px bg-border flex-shrink-0 mx-1" />

      {/* Overdue alert — only when relevant */}
      {overdueCount > 0 && (
        <button
          onClick={() => onFilterChange('confirmed')}
          className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold border border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700 flex-shrink-0 animate-pulse"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {overdueCount} Overdue
        </button>
      )}

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {PILLS.map(pill => {
          const count = counts[pill.status] || 0;
          const isActive = activeFilter === pill.status;
          const Icon = pill.icon;
          if (pill.status !== 'all' && count === 0) return null; // hide empty statuses

          return (
            <button
              key={pill.status}
              onClick={() => onFilterChange(pill.status as any)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-all duration-150 flex-shrink-0',
                isActive
                  ? cn(pill.bgActive, 'border-2')
                  : 'bg-transparent border-border text-muted-foreground hover:bg-muted'
              )}
            >
              <Icon className={cn('h-3 w-3', isActive ? pill.color : '')} />
              <span>{pill.label}</span>
              {count > 0 && (
                <span className={cn(
                  'ml-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold px-1',
                  isActive ? 'bg-current/15' : 'bg-muted'
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
