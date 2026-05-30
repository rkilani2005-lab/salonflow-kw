import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { STATUS_META } from './statusMeta';
import type { AppointmentStatus } from '@/types/calendar';

const STATUS_ORDER: AppointmentStatus[] = [
  'planned', 'confirmed', 'checked_in', 'in_service', 'completed', 'no_show', 'cancelled',
];

// Mirrors AppointmentCard's STATUS_CLASSES.pill — kept literal so
// Tailwind JIT detects every utility.
const PILL_CLASSES: Record<string, string> = {
  scheduled:    'bg-status-scheduled',
  confirmed:    'bg-status-confirmed',
  arrived:      'bg-status-arrived',
  'in-service': 'bg-status-in-service',
  completed:    'bg-status-completed',
  'no-show':    'bg-status-no-show',
  cancelled:    'bg-status-cancelled',
};

export function CalendarLegend() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const payLabel = (en: string, ar: string) => (isAr ? ar : en);

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2',
      'text-xs text-muted-foreground border-b bg-muted/20',
    )}>
      <span className="kicker text-[10px]">{isAr ? 'الحالة' : 'Status'}</span>
      {STATUS_ORDER.map(s => {
        const m = STATUS_META[s];
        return (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', PILL_CLASSES[m.key])} />
            <span>{isAr ? m.labelAr : m.labelEn}</span>
          </span>
        );
      })}

      <span className="mx-2 hidden sm:inline-block h-3 w-px bg-border" />

      <span className="kicker text-[10px]">{isAr ? 'الدفع' : 'Payment'}</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-pay-paid" />
        <span>{payLabel('Paid', 'مدفوع')}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-pay-partial" />
        <span>{payLabel('Partial', 'جزئي')}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full border border-pay-unpaid bg-transparent" />
        <span>{payLabel('Unpaid', 'غير مدفوع')}</span>
      </span>
    </div>
  );
}
