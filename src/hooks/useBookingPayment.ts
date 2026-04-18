import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Single source of truth for whether a booking has been paid.
 *
 * IMPORTANT: `booking.status === 'completed'` means the SERVICE was delivered.
 * It does NOT mean payment was collected.  Payment lives in the `transactions`
 * table with `status = 'completed'` and a matching `booking_id`.
 *
 * The UI must never treat booking.status alone as implying paid/checked-out.
 * Use this hook instead.
 */
export function useBookingPayment(bookingId: string | null | undefined) {
  return useQuery({
    queryKey: ['booking-payment', bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, grand_total, status, created_at')
        .eq('booking_id', bookingId!)
        .eq('status', 'completed')
        .maybeSingle();

      if (error) throw error;

      return {
        transaction: data,
        isPaid: !!data,
        grandTotal: Number(data?.grand_total ?? 0),
        paidAt: data?.created_at ?? null,
      };
    },
    staleTime: 15_000,
  });
}

/**
 * Lightweight non-hook variant for use inside event handlers
 * (e.g. Calendar status-change confirmation dialog).
 */
export async function fetchBookingPayment(bookingId: string) {
  const { data } = await supabase
    .from('transactions')
    .select('id, grand_total, status')
    .eq('booking_id', bookingId)
    .eq('status', 'completed')
    .maybeSingle();
  return { transaction: data, isPaid: !!data };
}
