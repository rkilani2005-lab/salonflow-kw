import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Calendar } from 'lucide-react';

interface Props {
  serviceId: string;
}

export const ServiceUsageHistory = ({ serviceId }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: ['service-usage-history', serviceId],
    queryFn: async () => {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, booking_date, start_time, client_name, client_phone, status, price, staff_id')
        .eq('service_id', serviceId)
        .order('booking_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return bookings;
    },
    enabled: !!serviceId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  const bookings = data || [];
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  // Count unique clients
  const uniqueClients = new Set(bookings.map(b => b.client_phone)).size;

  return (
    <div className="space-y-4 mt-2">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-lg font-bold">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Times Performed</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-lg font-bold">{uniqueClients}</p>
          <p className="text-xs text-muted-foreground">Unique Clients</p>
        </div>
      </div>

      {/* Booking List */}
      {bookings.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No bookings for this service yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{booking.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(booking.booking_date), 'MMM d, yyyy')} at {booking.start_time?.slice(0, 5)}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <Badge
                      variant={
                        booking.status === 'completed' ? 'default' :
                        booking.status === 'cancelled' ? 'destructive' : 'secondary'
                      }
                      className="text-xs"
                    >
                      {booking.status}
                    </Badge>
                    <span className="text-sm font-medium">{booking.price} KWD</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
