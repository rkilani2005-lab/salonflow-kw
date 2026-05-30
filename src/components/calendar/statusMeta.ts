/**
 * Single source of truth for the calendar status colour system.
 * Maps each `bookings.status` value to its design token and bilingual
 * label. Tokens are defined in src/index.css (`--status-*`) and exposed
 * through tailwind.config.ts as `bg-status-*` / `text-status-*` / etc.
 *
 * Adding a new status: add the enum value to bookings_status in the DB,
 * extend AppointmentStatus in types/calendar.ts, then add the row here
 * and the matching token in index.css. Do NOT colour-only-encode — every
 * status must carry a text label too (a11y).
 */
import type { AppointmentStatus } from '@/types/calendar';

export interface StatusMeta {
  /** Tailwind colour suffix matching theme.colors.status.* */
  key:
    | 'scheduled'
    | 'confirmed'
    | 'arrived'
    | 'in-service'
    | 'completed'
    | 'no-show'
    | 'cancelled';
  labelEn: string;
  labelAr: string;
}

export const STATUS_META: Record<AppointmentStatus, StatusMeta> = {
  planned:    { key: 'scheduled',  labelEn: 'Scheduled',  labelAr: 'مجدول'   },
  confirmed:  { key: 'confirmed',  labelEn: 'Confirmed',  labelAr: 'مؤكد'    },
  checked_in: { key: 'arrived',    labelEn: 'Arrived',    labelAr: 'وصل'     },
  in_service: { key: 'in-service', labelEn: 'In service', labelAr: 'قيد الخدمة' },
  completed:  { key: 'completed',  labelEn: 'Completed',  labelAr: 'منتهي'   },
  no_show:    { key: 'no-show',    labelEn: 'No-show',    labelAr: 'لم يحضر' },
  cancelled:  { key: 'cancelled',  labelEn: 'Cancelled',  labelAr: 'ملغي'    },
};

/** Whether the payment-state dot is meaningful for this status.
 *  Before the service happens, "paid vs unpaid" isn't a useful question. */
export function showsPaymentState(status: AppointmentStatus): boolean {
  return status === 'in_service' || status === 'completed';
}
