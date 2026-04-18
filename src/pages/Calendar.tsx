import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { StaffRosterSidebar } from '@/components/calendar/StaffRosterSidebar';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { BookingFormDialog, MultiServiceBooking } from '@/components/calendar/BookingFormDialog';
import { AppointmentDetailSheet } from '@/components/calendar/AppointmentDetailSheet';
import { ReceptionCommandBar } from '@/components/calendar/ReceptionCommandBar';
import { WalkInDialog } from '@/components/calendar/WalkInDialog';
import { TodayScheduleList } from '@/components/calendar/TodayScheduleList';
import { Appointment, AppointmentStatus, Staff, Service, Client, SERVICE_CATEGORY_COLORS } from '@/types/calendar';
import { useToast } from '@/hooks/use-toast';
import { useStaff } from '@/hooks/useStaff';
import { useClients } from '@/hooks/useClients';
import { useServicesManagement } from '@/hooks/useServices';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fireWhatsAppTrigger } from '@/lib/whatsapp-trigger';
import { format, isToday } from 'date-fns';
import type { Enums } from '@/integrations/supabase/types';
import { fetchBookingPayment } from '@/hooks/useBookingPayment';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

// ── Data hooks ─────────────────────────────────────────────────

function useBookings(date: Date) {
  return useQuery({
    queryKey: ['bookings-calendar', format(date, 'yyyy-MM')],
    queryFn: async () => {
      const startOfMonth = format(date, 'yyyy-MM-01');
      const endOfMonth = format(new Date(date.getFullYear(), date.getMonth() + 1, 0), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('bookings')
        .select('id, client_id, client_name, client_phone, staff_id, service_id, service_name, service_category, booking_date, start_time, end_time, duration, status, notes, price, is_online_booking')
        .gte('booking_date', startOfMonth)
        .lte('booking_date', endOfMonth)
        .order('start_time');
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });
}

function useCreateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (booking: {
      client_id?: string;
      client_name: string;
      client_phone: string;
      staff_id?: string;
      service_id?: string;
      service_name: string;
      service_category: Enums<'service_category'>;
      booking_date: string;
      start_time: string;
      end_time: string;
      duration: number;
      price: number;
      notes?: string;
      status?: string;
    }) => {
      const { data, error } = await supabase
        .from('bookings')
        .insert([{ ...booking, status: (booking.status || 'planned') as any }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] }),
    onError: (err) => toast({ title: 'Failed to create booking', description: err.message, variant: 'destructive' }),
  });
}

function mapBookingToAppointment(b: any): Appointment {
  return {
    id: b.id,
    clientId: b.client_id || '',
    clientName: b.client_name,
    staffId: b.staff_id || '',
    serviceId: b.service_id || '',
    serviceName: b.service_name,
    serviceCategory: b.service_category,
    date: b.booking_date,
    startTime: b.start_time?.slice(0, 5) || '09:00',
    endTime:   b.end_time?.slice(0, 5)   || '10:00',
    duration: b.duration,
    status: b.status,
    notes: b.notes,
    price: Number(b.price),
  };
}

// ── Main component ──────────────────────────────────────────────

export default function CalendarPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  const [date,             setDate]             = useState(new Date());
  const [searchParams, setSearchParams] = useSearchParams();

  // If navigated here from BookingRequests after confirming, jump to that date
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = new Date(dateParam + 'T00:00:00');
      if (!isNaN(parsed.getTime())) {
        setDate(parsed);
        setView('day');
      }
      // Remove the param so refreshing doesn't re-jump
      setSearchParams({}, { replace: true });
    }
  }, []);
  const [view,             setView]             = useState<'day' | 'week' | 'month'>('day');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [listMode,         setListMode]         = useState(false);
  const [statusFilter,     setStatusFilter]     = useState<AppointmentStatus | 'all'>('all');

  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [walkInOpen,        setWalkInOpen]        = useState(false);
  const [detailSheetOpen,   setDetailSheetOpen]   = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [preselectedStaffId,  setPreselectedStaffId]  = useState<string>();
  const [preselectedTime,     setPreselectedTime]     = useState<string>();

  // Data
  const { data: dbStaff    = [] } = useStaff();
  const { data: dbClients  = [] } = useClients();
  const { data: dbServices = [] } = useServicesManagement();
  const { data: dbBookings = [] } = useBookings(date);
  const createBooking = useCreateBooking();

  // Mapped data
  const staff: Staff[] = useMemo(() =>
    dbStaff.filter(s => s.is_active).map(s => ({
      id: s.id, name: s.name, nameAr: s.name_ar || undefined,
      avatar: s.avatar_url || undefined,
      color: s.color || 'hsl(220, 9%, 46%)',
      workingHours: {
        start: s.working_hours_start?.slice(0, 5) || '09:00',
        end:   s.working_hours_end?.slice(0, 5)   || '21:00',
      },
      breaks: s.break_start && s.break_end
        ? [{ start: s.break_start.slice(0, 5), end: s.break_end.slice(0, 5) }]
        : undefined,
      skills: [], status: 'available' as const,
    })), [dbStaff]);

  const services: Service[] = useMemo(() =>
    dbServices.filter(s => s.is_active).map(s => ({
      id: s.id, name: s.name, nameAr: s.name_ar || undefined,
      category: s.category as any, duration: s.duration, price: Number(s.price),
      color: s.color || SERVICE_CATEGORY_COLORS[s.category as keyof typeof SERVICE_CATEGORY_COLORS] || 'hsl(220,9%,46%)',
    })), [dbServices]);

  const clients: Client[] = useMemo(() =>
    dbClients.map(c => ({
      id: c.id, name: c.name, mobile: c.phone, email: c.email || undefined,
      tier: (c.tier === 'vip' || c.tier === 'vvip') ? 'vip' as const : 'normal' as const,
    })), [dbClients]);

  const appointments: Appointment[] = useMemo(() =>
    dbBookings.map(mapBookingToAppointment), [dbBookings]);

  // Today's appointments for the command bar and list
  const todayStr = format(date, 'yyyy-MM-dd');
  const todayAppointments = useMemo(() =>
    appointments.filter(a => a.date === todayStr), [appointments, todayStr]);

  // Filtered appointments for display
  const displayAppointments = useMemo(() => {
    const dayAppts = view === 'day'
      ? appointments.filter(a => a.date === todayStr)
      : appointments;
    if (statusFilter === 'all') return dayAppts;
    return dayAppts.filter(a => a.status === statusFilter);
  }, [appointments, view, todayStr, statusFilter]);

  const [visibleStaffIds, setVisibleStaffIds] = useState<string[]>([]);
  const effectiveVisibleStaffIds = visibleStaffIds.length > 0
    ? visibleStaffIds
    : staff.map(s => s.id);

  const handleToggleStaff = (staffId: string) => {
    setVisibleStaffIds(prev => {
      const base = prev.length > 0 ? prev : staff.map(s => s.id);
      return base.includes(staffId) ? base.filter(id => id !== staffId) : [...base, staffId];
    });
  };

  const handleSlotClick = useCallback((staffId: string, time: string) => {
    setPreselectedStaffId(staffId);
    setPreselectedTime(time);
    setBookingDialogOpen(true);
  }, []);

  const handleAppointmentMove = useCallback(async (
    appointmentId: string, newStaffId: string, newTime: string
  ) => {
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) return;
    const [h, m] = newTime.split(':').map(Number);
    const endMins = h * 60 + m + apt.duration;
    const endTime = `${Math.floor(endMins / 60).toString().padStart(2, '0')}:${(endMins % 60).toString().padStart(2, '0')}`;
    await supabase.from('bookings').update({ staff_id: newStaffId, start_time: newTime, end_time: endTime }).eq('id', appointmentId);
    queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
  }, [appointments, queryClient]);

  // Confirmation dialog state for marking 'completed' without a recorded payment.
  const [pendingComplete, setPendingComplete] = useState<{ id: string } | null>(null);
  const navigate = useNavigate();

  const applyStatusChange = useCallback(async (appointmentId: string, newStatus: AppointmentStatus) => {
    await supabase.from('bookings').update({ status: newStatus as Enums<'booking_status'> }).eq('id', appointmentId);
    queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
    setSelectedAppointment(prev => prev?.id === appointmentId ? { ...prev, status: newStatus } : prev);
    const labels: Record<string, string> = {
      confirmed: '✓ Confirmed', checked_in: '👋 Client arrived', in_service: '✂️ In service',
      completed: '✅ Completed', no_show: '⚠️ Marked as no-show', cancelled: '✗ Cancelled',
    };
    toast({ title: labels[newStatus] || 'Status updated' });

    // Fire WhatsApp trigger for terminal-interest transitions.  Only
    // confirmed and cancelled have configured triggers in the UI;
    // other status changes are internal salon flow and don't ping the
    // client.  Best-effort — wrapped inside the helper which never
    // throws.
    if (tenant && (newStatus === 'confirmed' || newStatus === 'cancelled')) {
      const { data: b } = await supabase
        .from('bookings')
        .select('id, client_phone, client_name, service_name, booking_date, start_time')
        .eq('id', appointmentId)
        .single();
      if (b?.client_phone) {
        fireWhatsAppTrigger({
          tenant_id:      tenant.id,
          event_type:     newStatus === 'confirmed' ? 'booking_confirmed' : 'booking_cancelled',
          phone_number:   b.client_phone,
          reference_id:   b.id,
          reference_type: 'booking',
          variables: {
            client_name:   b.client_name || '',
            service_name:  b.service_name || '',
            booking_date:  b.booking_date || '',
            start_time:    b.start_time || '',
          },
        });
      }
    }
  }, [queryClient, toast, tenant]);

  const handleStatusChange = useCallback(async (appointmentId: string, newStatus: AppointmentStatus) => {
    // Guard: marking an appointment 'completed' should normally flow through POS.
    // If the user tries to set it directly without a recorded payment, intercept
    // and ask what they mean.  This prevents the "invoice looks fully paid when
    // nothing was collected" bug.
    if (newStatus === 'completed') {
      const { isPaid } = await fetchBookingPayment(appointmentId);
      if (!isPaid) {
        setPendingComplete({ id: appointmentId });
        return;
      }
    }
    await applyStatusChange(appointmentId, newStatus);
  }, [applyStatusChange]);

  const handleBookingSubmit = useCallback(async (booking: {
    clientId: string; staffId: string; serviceId: string; date: string; time: string; notes: string;
  }) => {
    const client  = clients.find(c => c.id === booking.clientId);
    const service = services.find(s => s.id === booking.serviceId);
    if (!client || !service) return;
    const [h, m] = booking.time.split(':').map(Number);
    const endMins = h * 60 + m + service.duration;
    const endTime = `${Math.floor(endMins / 60).toString().padStart(2, '0')}:${(endMins % 60).toString().padStart(2, '0')}`;
    await createBooking.mutateAsync({
      client_id: booking.clientId, client_name: client.name, client_phone: client.mobile,
      staff_id: booking.staffId, service_id: booking.serviceId, service_name: service.name,
      service_category: service.category as Enums<'service_category'>,
      booking_date: booking.date, start_time: booking.time, end_time: endTime,
      duration: service.duration, price: service.price, notes: booking.notes, status: 'confirmed',
    });
    toast({ title: '📅 Appointment booked', description: `${client.name} · ${service.name}` });

    // Fire WhatsApp booking_confirmed.  Best-effort; does not block.
    if (tenant && client.mobile) {
      fireWhatsAppTrigger({
        tenant_id:      tenant.id,
        event_type:     'booking_confirmed',
        phone_number:   client.mobile,
        reference_type: 'booking',
        variables: {
          client_name:  client.name,
          service_name: service.name,
          booking_date: booking.date,
          start_time:   booking.time,
        },
      });
    }
  }, [clients, services, createBooking, toast, tenant]);

  const handleMultiServiceSubmit = useCallback(async (booking: MultiServiceBooking) => {
    const client = clients.find(c => c.id === booking.clientId);
    if (!client) return;
    for (const entry of booking.services) {
      const service = services.find(s => s.id === entry.serviceId);
      if (!service) continue;
      const [h, m] = entry.time.split(':').map(Number);
      const endMins = h * 60 + m + service.duration;
      const endTime = `${Math.floor(endMins / 60).toString().padStart(2, '0')}:${(endMins % 60).toString().padStart(2, '0')}`;
      await createBooking.mutateAsync({
        client_id: booking.clientId, client_name: client.name, client_phone: client.mobile,
        staff_id: entry.staffId, service_id: entry.serviceId, service_name: service.name,
        service_category: service.category as Enums<'service_category'>,
        booking_date: booking.date, start_time: entry.time, end_time: endTime,
        duration: service.duration, price: service.price, notes: booking.notes, status: 'confirmed',
      });
    }
    toast({ title: '📅 Multi-service booking created', description: `${client.name} · ${booking.services.length} services` });
  }, [clients, services, createBooking, toast]);

  // Walk-in: create as checked_in immediately
  const handleWalkInSubmit = useCallback(async (walkin: {
    clientName: string; clientPhone: string; clientId?: string; staffId: string; serviceId: string; startTime: string; notes: string; isWalkIn: true;
  }) => {
    const service = services.find(s => s.id === walkin.serviceId);
    if (!service) return;
    const [h, m] = walkin.startTime.split(':').map(Number);
    const endMins = h * 60 + m + service.duration;
    const endTime = `${Math.floor(endMins / 60).toString().padStart(2, '0')}:${(endMins % 60).toString().padStart(2, '0')}`;
    await createBooking.mutateAsync({
      client_id: walkin.clientId || null,
      client_name: walkin.clientName, client_phone: walkin.clientPhone,
      staff_id: walkin.staffId, service_id: walkin.serviceId, service_name: service.name,
      service_category: service.category as Enums<'service_category'>,
      booking_date: format(date, 'yyyy-MM-dd'),
      start_time: walkin.startTime, end_time: endTime,
      duration: service.duration, price: service.price,
      notes: walkin.notes || 'Walk-in',
      status: 'checked_in',  // walk-ins start as checked_in immediately
    });
    toast({ title: '🚶‍♀️ Walk-in checked in', description: `${walkin.clientName} · ${service.name}` });
  }, [services, date, createBooking, toast]);

  const handleAppointmentClick = useCallback((apt: Appointment) => {
    setSelectedAppointment(apt);
    setDetailSheetOpen(true);
  }, []);

  const handleAppointmentUpdate = useCallback(async (updated: Appointment) => {
    await supabase.from('bookings').update({
      staff_id: updated.staffId || null, start_time: updated.startTime,
      end_time: updated.endTime, notes: updated.notes,
    }).eq('id', updated.id);
    queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
    toast({ title: 'Appointment updated' });
  }, [queryClient, toast]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top header */}
      <CalendarHeader
        date={date}
        view={view}
        sidebarCollapsed={sidebarCollapsed}
        listMode={listMode}
        onDateChange={setDate}
        onViewChange={setView}
        onToggleSidebar={() => setSidebarCollapsed(p => !p)}
        onToggleListMode={() => setListMode(p => !p)}
      />

      {/* Reception command bar — always visible */}
      <ReceptionCommandBar
        appointments={todayAppointments}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        onWalkIn={() => setWalkInOpen(true)}
        date={date}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Staff sidebar */}
        <StaffRosterSidebar
          staff={staff}
          visibleStaffIds={effectiveVisibleStaffIds}
          collapsed={sidebarCollapsed}
          date={date}
          onDateSelect={(d) => d && setDate(d)}
          onToggleStaff={handleToggleStaff}
        />

        {/* Grid or list mode */}
        {listMode ? (
          <div className="flex-1 overflow-hidden">
            <TodayScheduleList
              appointments={statusFilter === 'all' ? todayAppointments : todayAppointments.filter(a => a.status === statusFilter)}
              staff={staff}
              services={services}
              onStatusChange={handleStatusChange}
              onAppointmentClick={handleAppointmentClick}
              date={date}
            />
          </div>
        ) : (
          <CalendarGrid
            staff={staff}
            appointments={displayAppointments}
            visibleStaffIds={effectiveVisibleStaffIds}
            startHour={8}
            endHour={21}
            view={view}
            date={date}
            onSlotClick={handleSlotClick}
            onAppointmentMove={handleAppointmentMove}
            onAppointmentClick={handleAppointmentClick}
          />
        )}
      </div>

      {/* Dialogs */}
      <BookingFormDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        staff={staff}
        services={services}
        clients={clients}
        preselectedStaffId={preselectedStaffId}
        preselectedTime={preselectedTime}
        preselectedDate={todayStr}
        onSubmit={handleBookingSubmit}
        onSubmitMulti={handleMultiServiceSubmit}
      />

      <WalkInDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        staff={staff}
        services={services}
        onSubmit={handleWalkInSubmit}
      />

      <AppointmentDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        appointment={selectedAppointment}
        allAppointments={appointments}
        staff={staff}
        services={services}
        clients={clients}
        onUpdate={handleAppointmentUpdate}
        onStatusChange={handleStatusChange}
      />

      {/* Guard: marking an appointment complete without a recorded payment. */}
      <AlertDialog
        open={!!pendingComplete}
        onOpenChange={(open) => !open && setPendingComplete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark service complete without payment?</AlertDialogTitle>
            <AlertDialogDescription>
              No completed transaction is linked to this appointment. Marking it
              complete now will record the service as delivered but will NOT
              register any payment. The invoice will remain unpaid.
              <br /><br />
              The recommended action is to collect payment through POS, which
              marks the appointment complete automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (pendingComplete) {
                  const id = pendingComplete.id;
                  setPendingComplete(null);
                  navigate(`/pos?bookingId=${id}`);
                }
              }}
            >
              Go to POS instead
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (pendingComplete) {
                  const id = pendingComplete.id;
                  setPendingComplete(null);
                  applyStatusChange(id, 'completed');
                }
              }}
            >
              Complete without payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
