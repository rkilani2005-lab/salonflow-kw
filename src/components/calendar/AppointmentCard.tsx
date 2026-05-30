import { Appointment } from '@/types/calendar';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { CreditCard, FileText, Users } from 'lucide-react';
import { STATUS_META, showsPaymentState } from './statusMeta';
import { useLanguage } from '@/contexts/LanguageContext';
import { useServicesManagement } from '@/hooks/useServices';

interface AppointmentCardProps {
  appointment: Appointment;
  columnHeight: number;
  startHour: number;
  onAppointmentClick?: (appointment: Appointment) => void;
}

export function AppointmentCard({ appointment, columnHeight, startHour, onAppointmentClick }: AppointmentCardProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { data: servicesList } = useServicesManagement();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: appointment,
  });

  // ── Layout ──────────────────────────────────────────────────────
  const [startH, startM] = appointment.startTime.split(':').map(Number);
  const startMinutes = (startH - startHour) * 60 + startM;
  const top = (startMinutes / 60) * columnHeight;
  const height = (appointment.duration / 60) * columnHeight;

  const style = {
    transform: CSS.Translate.toString(transform),
    top: `${top}px`,
    height: `${height}px`,
  };

  // ── Status (dominant cue) ───────────────────────────────────────
  const meta = STATUS_META[appointment.status];
  const statusLabel = language === 'ar' ? meta.labelAr : meta.labelEn;
  const isDimmed = appointment.status === 'cancelled' || appointment.status === 'no_show';
  const isLive   = appointment.status === 'in_service' || appointment.status === 'checked_in';

  // Use plain class strings (rather than dynamic template literals) so
  // Tailwind's JIT can statically detect every utility. Each map entry
  // is a literal recognised at build time.
  const STATUS_CLASSES: Record<typeof meta.key, {
    border: string; pill: string; tint: string;
  }> = {
    scheduled:    { border: 'border-l-status-scheduled',  pill: 'bg-status-scheduled/15 text-status-scheduled',   tint: '' },
    confirmed:    { border: 'border-l-status-confirmed',  pill: 'bg-status-confirmed/15 text-status-confirmed',   tint: '' },
    arrived:      { border: 'border-l-status-arrived',    pill: 'bg-status-arrived/15 text-status-arrived',       tint: 'bg-status-arrived/[0.06]' },
    'in-service': { border: 'border-l-status-in-service', pill: 'bg-status-in-service/15 text-status-in-service', tint: 'bg-status-in-service/[0.06]' },
    completed:    { border: 'border-l-status-completed',  pill: 'bg-status-completed/15 text-status-completed',   tint: '' },
    'no-show':    { border: 'border-l-status-no-show',    pill: 'bg-status-no-show/15 text-status-no-show',       tint: '' },
    cancelled:    { border: 'border-l-status-cancelled',  pill: 'bg-status-cancelled/15 text-status-cancelled',   tint: '' },
  };
  const c = STATUS_CLASSES[meta.key];

  // ── Payment state (secondary axis) ──────────────────────────────
  const showPayDot = showsPaymentState(appointment.status);
  const isPaid     = !!appointment.isPaid;
  const paidAmt    = appointment.paidAmount ?? 0;
  const dueAmt     = appointment.price;
  const payTooltip = isPaid
    ? (language === 'ar' ? `مدفوع · ${paidAmt.toFixed(3)} د.ك` : `Paid · ${paidAmt.toFixed(3)} KWD`)
    : (language === 'ar' ? `غير مدفوع · ${dueAmt.toFixed(3)} د.ك مستحق` : `Unpaid · ${dueAmt.toFixed(3)} KWD due`);

  // ── Service-color accent (demoted from primary cue → 2px underline) ─
  const serviceColor = servicesList?.find(s => s.id === appointment.serviceId)?.color;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            'absolute left-1 right-1 rounded-md px-2 py-1 cursor-grab active:cursor-grabbing',
            'border border-border bg-card shadow-sm overflow-hidden transition-shadow',
            'border-l-4', c.border, c.tint,
            isDimmed && 'bg-muted/60',
            isDragging && 'opacity-50 shadow-lg z-50',
            appointment.groupId && 'ring-2 ring-primary/30 ring-offset-1 ring-offset-transparent',
          )}
          {...listeners}
          {...attributes}
        >
          <div className="flex flex-col h-full">
            {/* Top row: client name + status pill */}
            <div className="flex items-start gap-1">
              <p
                className={cn(
                  'text-xs font-semibold truncate flex-1 leading-tight',
                  isDimmed ? 'text-muted-foreground font-medium' : 'text-foreground',
                )}
              >
                {appointment.clientName}
              </p>
              {appointment.groupId && (
                <span className="shrink-0 w-4 h-4 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <Users className="h-2.5 w-2.5" />
                </span>
              )}
              <span
                className={cn(
                  'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap',
                  c.pill,
                )}
              >
                {statusLabel}
              </span>
            </div>

            {/* Service name — with optional 2px service-color underline accent. */}
            <p
              className={cn(
                'text-[11px] truncate inline-block max-w-full',
                isDimmed ? 'text-muted-foreground/80' : 'text-muted-foreground',
              )}
              style={serviceColor && !isDimmed ? { boxShadow: `inset 0 -2px 0 0 ${serviceColor}` } : undefined}
            >
              {appointment.serviceName}
            </p>

            {/* Bottom row: time (strike-through if cancelled) + payment dot */}
            {height > 50 && (
              <div className="mt-auto flex items-center justify-between gap-1">
                <p
                  className={cn(
                    'text-[10px] tabular-nums',
                    isDimmed ? 'text-muted-foreground/70' : 'text-muted-foreground',
                    appointment.status === 'cancelled' && 'line-through',
                  )}
                >
                  {appointment.startTime} – {appointment.endTime}
                </p>
                {showPayDot && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        aria-label={payTooltip}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0',
                          isPaid
                            ? 'bg-pay-paid'
                            : 'border border-pay-unpaid bg-transparent',
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {payTooltip}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="space-y-2">
          <div>
            <p className="font-semibold">{appointment.clientName}</p>
            <p className="text-sm text-muted-foreground">{appointment.serviceName}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', c.pill)}>
              {statusLabel}
            </span>
            {showPayDot && (
              <span className="flex items-center gap-1 text-xs">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isPaid ? 'bg-pay-paid' : 'border border-pay-unpaid bg-transparent',
                  )}
                />
                {payTooltip}
              </span>
            )}
          </div>
          <p className="text-sm">
            {appointment.startTime} – {appointment.endTime} ({appointment.duration} min)
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onAppointmentClick?.(appointment);
              }}
            >
              <FileText className="mr-1 h-3 w-3" />
              Details
            </Button>
            {(appointment.status === 'completed' || appointment.status === 'in_service') && (
              <Button
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/pos?bookingId=${appointment.id}&from=calendar`, { state: { returnTo: '/calendar', fromAppointmentId: appointment.id } });
                }}
              >
                <CreditCard className="mr-1 h-3 w-3" />
                Checkout
              </Button>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
