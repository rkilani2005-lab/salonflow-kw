import { useState, useCallback, useMemo } from 'react';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { StaffRosterSidebar } from '@/components/calendar/StaffRosterSidebar';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { BookingFormDialog, MultiServiceBooking } from '@/components/calendar/BookingFormDialog';
import { AppointmentDetailSheet } from '@/components/calendar/AppointmentDetailSheet';
import { Appointment, AppointmentStatus, Staff, Service, Client, SERVICE_CATEGORY_COLORS } from '@/types/calendar';
import { useToast } from '@/hooks/use-toast';
import { useStaff } from '@/hooks/useStaff';
import { useClients } from '@/hooks/useClients';
import { useServicesManagement } from '@/hooks/useServices';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import type { Enums } from '@/integrations/supabase/types';

function useBookings(date: Date, view: 'day' | 'week' | 'month') {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['bookings-calendar', tenant?.id, format(date, 'yyyy-MM'), view],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('start_time');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
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
    }) => {
      const { data, error } = await supabase.from('bookings').insert(booking).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
      toast({ title: 'Booking Created' });
    },
    onError: (err) => toast({ title: 'Failed to create booking', description: err.message, variant: 'destructive' }),
  });
}

function useUpdateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ReturnType<typeof mapBookingToAppointment>> & { id: string }) => {
      const { error } = await supabase.from('bookings').update({
        staff_id: data.staffId,
        start_time: data.startTime,
        end_time: data.endTime,
        notes: data.notes,
        status: data.status as Enums<'booking_status'>,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
    },
    onError: (err) => toast({ title: 'Failed to update booking', description: err.message, variant: 'destructive' }),
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
    endTime: b.end_time?.slice(0, 5) || '10:00',
    duration: b.duration,
    status: b.status,
    notes: b.notes,
    price: Number(b.price),
  };
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [preselectedStaffId, setPreselectedStaffId] = useState<string>();
  const [preselectedTime, setPreselectedTime] = useState<string>();
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // DB data
  const { data: dbStaff = [] } = useStaff();
  const { data: dbClients = [] } = useClients();
  const { data: dbServices = [] } = useServicesManagement();
  const { data: dbBookings = [] } = useBookings(date, view);
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const queryClient = useQueryClient();

  // Map DB staff → calendar Staff type
  const staff: Staff[] = useMemo(() =>
    dbStaff.filter(s => s.is_active).map(s => ({
      id: s.id,
      name: s.name,
      nameAr: s.name_ar || undefined,
      avatar: s.avatar_url || undefined,
      color: s.color || 'hsl(220, 9%, 46%)',
      workingHours: {
        start: s.working_hours_start?.slice(0, 5) || '09:00',
        end: s.working_hours_end?.slice(0, 5) || '18:00',
      },
      breaks: s.break_start && s.break_end
        ? [{ start: s.break_start.slice(0, 5), end: s.break_end.slice(0, 5) }]
        : undefined,
      skills: [],
      status: 'available' as const,
    })), [dbStaff]);

  // Map DB services → calendar Service type
  const services: Service[] = useMemo(() =>
    dbServices.filter(s => s.is_active).map(s => ({
      id: s.id,
      name: s.name,
      nameAr: s.name_ar || undefined,
      category: s.category as any,
      duration: s.duration,
      price: Number(s.price),
      color: s.color || SERVICE_CATEGORY_COLORS[s.category as keyof typeof SERVICE_CATEGORY_COLORS] || 'hsl(220,9%,46%)',
    })), [dbServices]);

  // Map DB clients → calendar Client type
  const clients: Client[] = useMemo(() =>
    dbClients.map(c => ({
      id: c.id,
      name: c.name,
      mobile: c.phone,
      email: c.email || undefined,
      tier: (c.tier === 'vip' || c.tier === 'vvip') ? 'vip' as const : 'normal' as const,
    })), [dbClients]);

  // Map DB bookings → Appointment type
  const appointments: Appointment[] = useMemo(() =>
    dbBookings.map(mapBookingToAppointment), [dbBookings]);

  const [visibleStaffIds, setVisibleStaffIds] = useState<string[]>([]);
  const effectiveVisibleStaffIds = visibleStaffIds.length > 0
    ? visibleStaffIds
    : staff.map(s => s.id);

  const handleToggleStaff = (staffId: string) => {
    setVisibleStaffIds(prev => {
      const base = prev.length > 0 ? prev : staff.map(s => s.id);
      return base.includes(staffId)
        ? base.filter(id => id !== staffId)
        : [...base, staffId];
    });
  };

  const handleSlotClick = useCallback((staffId: string, time: string) => {
    setPreselectedStaffId(staffId);
    setPreselectedTime(time);
    setBookingDialogOpen(true);
  }, []);

  const handleAppointmentMove = useCallback(async (
    appointmentId: string,
    newStaffId: string,
    newTime: string
  ) => {
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) return;
    const [h, m] = newTime.split(':').map(Number);
    const endMins = h * 60 + m + apt.duration;
    const endTime = `${Math.floor(endMins / 60).toString().padStart(2, '0')}:${(endMins % 60).toString().padStart(2, '0')}`;
    await supabase.from('bookings').update({ staff_id: newStaffId, start_time: newTime, end_time: endTime }).eq('id', appointmentId);
    queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
  }, [appointments, queryClient]);

  const handleBookingSubmit = useCallback(async (booking: {
    clientId: string;
    staffId: string;
    serviceId: string;
    date: string;
    time: string;
    notes: string;
  }) => {
    const client = clients.find(c => c.id === booking.clientId);
    const service = services.find(s => s.id === booking.serviceId);
    if (!client || !service) return;

    const [h, m] = booking.time.split(':').map(Number);
    const endMins = h * 60 + m + service.duration;
    const endTime = `${Math.floor(endMins / 60).toString().padStart(2, '0')}:${(endMins % 60).toString().padStart(2, '0')}`;

    await createBooking.mutateAsync({
      client_id: booking.clientId,
      client_name: client.name,
      client_phone: client.mobile,
      staff_id: booking.staffId,
      service_id: booking.serviceId,
      service_name: service.name,
      service_category: service.category as Enums<'service_category'>,
      booking_date: booking.date,
      start_time: booking.time,
      end_time: endTime,
      duration: service.duration,
      price: service.price,
      notes: booking.notes,
    });

    toast({ title: 'Booking Created', description: `${client.name}'s appointment for ${service.name} has been scheduled.` });
  }, [clients, services, createBooking, toast]);

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
        client_id: booking.clientId,
        client_name: client.name,
        client_phone: client.mobile,
        staff_id: entry.staffId,
        service_id: entry.serviceId,
        service_name: service.name,
        service_category: service.category as Enums<'service_category'>,
        booking_date: booking.date,
        start_time: entry.time,
        end_time: endTime,
        duration: service.duration,
        price: service.price,
        notes: booking.notes,
      });
    }

    toast({ title: 'Multi-Service Booking Created', description: `${client.name}'s appointments have been scheduled.` });
  }, [clients, services, createBooking, toast]);

  const handleAppointmentClick = useCallback((apt: Appointment) => {
    setSelectedAppointment(apt);
    setDetailSheetOpen(true);
  }, []);

  const handleAppointmentUpdate = useCallback(async (updated: Appointment) => {
    await supabase.from('bookings').update({
      staff_id: updated.staffId || null,
      start_time: updated.startTime,
      end_time: updated.endTime,
      notes: updated.notes,
    }).eq('id', updated.id);
    queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
    toast({ title: 'Appointment Updated' });
  }, [queryClient, toast]);

  const handleStatusChange = useCallback(async (appointmentId: string, newStatus: AppointmentStatus) => {
    await supabase.from('bookings').update({ status: newStatus as Enums<'booking_status'> }).eq('id', appointmentId);
    queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
    setSelectedAppointment(prev => prev?.id === appointmentId ? { ...prev, status: newStatus } : prev);
    toast({ title: 'Status Updated', description: `Appointment status changed to ${newStatus.replace('_', ' ')}.` });
  }, [queryClient, toast]);

  const filteredAppointments = useMemo(() => {
    if (view === 'day') {
      const dayStr = format(date, 'yyyy-MM-dd');
      return appointments.filter(a => a.date === dayStr);
    }
    return appointments;
  }, [appointments, view, date]);

  const todayStr = format(date, 'yyyy-MM-dd');

  return (
    <div className="h-screen flex flex-col bg-background">
      <CalendarHeader
        date={date}
        view={view}
        sidebarCollapsed={sidebarCollapsed}
        onDateChange={setDate}
        onViewChange={setView}
        onToggleSidebar={() => setSidebarCollapsed(p => !p)}
      />

      <div className="flex-1 flex overflow-hidden">
        <StaffRosterSidebar
          staff={staff}
          visibleStaffIds={effectiveVisibleStaffIds}
          collapsed={sidebarCollapsed}
          date={date}
          onDateSelect={(d) => d && setDate(d)}
          onToggleStaff={handleToggleStaff}
        />

        <CalendarGrid
          staff={staff}
          appointments={filteredAppointments}
          visibleStaffIds={effectiveVisibleStaffIds}
          startHour={8}
          endHour={21}
          view={view}
          date={date}
          onSlotClick={handleSlotClick}
          onAppointmentMove={handleAppointmentMove}
          onAppointmentClick={handleAppointmentClick}
        />
      </div>

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
    </div>
  );
}
