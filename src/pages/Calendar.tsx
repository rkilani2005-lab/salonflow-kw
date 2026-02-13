 import { useState, useCallback } from 'react';
 import { CalendarHeader } from '@/components/calendar/CalendarHeader';
 import { StaffRosterSidebar } from '@/components/calendar/StaffRosterSidebar';
 import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { BookingFormDialog } from '@/components/calendar/BookingFormDialog';
import { AppointmentDetailSheet } from '@/components/calendar/AppointmentDetailSheet';
import { mockStaff, mockServices, mockClients, mockAppointments } from '@/data/mockCalendarData';
import { Appointment, AppointmentStatus } from '@/types/calendar';
import { useToast } from '@/hooks/use-toast';
 
 export default function CalendarPage() {
   const { toast } = useToast();
   const [date, setDate] = useState(new Date());
   const [view, setView] = useState<'day' | 'week' | 'month'>('day');
   const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
   const [visibleStaffIds, setVisibleStaffIds] = useState(mockStaff.map((s) => s.id));
   const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
 
   // Booking form state
    const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
    const [preselectedStaffId, setPreselectedStaffId] = useState<string>();
    const [preselectedTime, setPreselectedTime] = useState<string>();
    const [detailSheetOpen, setDetailSheetOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
 
   const handleDateChange = (newDate: Date) => setDate(newDate);
   const handleViewChange = (newView: 'day' | 'week' | 'month') => setView(newView);
   const handleToggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
 
   const handleDateSelect = (newDate: Date | undefined) => {
     if (newDate) setDate(newDate);
   };
 
   const handleToggleStaff = (staffId: string) => {
     setVisibleStaffIds((prev) =>
       prev.includes(staffId)
         ? prev.filter((id) => id !== staffId)
         : [...prev, staffId]
     );
   };
 
   const handleSlotClick = useCallback((staffId: string, time: string) => {
     setPreselectedStaffId(staffId);
     setPreselectedTime(time);
     setBookingDialogOpen(true);
   }, []);
 
   const handleAppointmentMove = useCallback((
     appointmentId: string,
     newStaffId: string,
     newTime: string
   ) => {
     setAppointments((prev) =>
       prev.map((apt) => {
         if (apt.id !== appointmentId) return apt;
         
         const [h, m] = newTime.split(':').map(Number);
         const startMinutes = h * 60 + m;
         const endMinutes = startMinutes + apt.duration;
         const endH = Math.floor(endMinutes / 60);
         const endM = endMinutes % 60;
         const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
         
         return {
           ...apt,
           staffId: newStaffId,
           startTime: newTime,
           endTime,
         };
       })
     );
   }, []);
 
   const handleBookingSubmit = useCallback((booking: {
     clientId: string;
     staffId: string;
     serviceId: string;
     date: string;
     time: string;
     notes: string;
   }) => {
     const client = mockClients.find((c) => c.id === booking.clientId);
     const service = mockServices.find((s) => s.id === booking.serviceId);
     
     if (!client || !service) return;
 
     const [h, m] = booking.time.split(':').map(Number);
     const startMinutes = h * 60 + m;
     const endMinutes = startMinutes + service.duration;
     const endH = Math.floor(endMinutes / 60);
     const endM = endMinutes % 60;
     const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
 
     const newAppointment: Appointment = {
       id: `apt-${Date.now()}`,
       clientId: booking.clientId,
       clientName: client.name,
       staffId: booking.staffId,
       serviceId: booking.serviceId,
       serviceName: service.name,
       serviceCategory: service.category,
       date: booking.date,
       startTime: booking.time,
       endTime,
       duration: service.duration,
       status: 'planned',
       notes: booking.notes,
       price: service.price,
     };
 
     setAppointments((prev) => [...prev, newAppointment]);
     
     toast({
       title: 'Booking Created',
       description: `${client.name}'s appointment for ${service.name} has been scheduled.`,
     });
    }, [toast]);

    const handleAppointmentClick = useCallback((apt: Appointment) => {
      setSelectedAppointment(apt);
      setDetailSheetOpen(true);
    }, []);

    const handleAppointmentUpdate = useCallback((updated: Appointment) => {
      setAppointments((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a))
      );
      toast({ title: 'Appointment Updated', description: `${updated.clientName}'s appointment has been updated.` });
    }, [toast]);

    const handleStatusChange = useCallback((appointmentId: string, newStatus: AppointmentStatus) => {
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: newStatus } : a))
      );
      setSelectedAppointment((prev) => prev?.id === appointmentId ? { ...prev, status: newStatus } : prev);
      toast({ title: 'Status Updated', description: `Appointment status changed to ${newStatus.replace('_', ' ')}.` });
    }, [toast]);
 
  // Filter appointments based on view
  const getFilteredAppointments = () => {
    if (view === 'day') {
      const dayStr = date.toISOString().split('T')[0];
      return appointments.filter((a) => a.date === dayStr);
    }
    // For week/month views, return all appointments (filtering happens in the view components)
    return appointments;
  };
  
  const filteredAppointments = getFilteredAppointments();
 
  const todayStr = date.toISOString().split('T')[0];

   return (
     <div className="h-screen flex flex-col bg-background">
       <CalendarHeader
         date={date}
         view={view}
         sidebarCollapsed={sidebarCollapsed}
         onDateChange={handleDateChange}
         onViewChange={handleViewChange}
         onToggleSidebar={handleToggleSidebar}
       />
 
       <div className="flex-1 flex overflow-hidden">
         <StaffRosterSidebar
           staff={mockStaff}
           visibleStaffIds={visibleStaffIds}
           collapsed={sidebarCollapsed}
           date={date}
           onDateSelect={handleDateSelect}
           onToggleStaff={handleToggleStaff}
         />
 
          <CalendarGrid
            staff={mockStaff}
           appointments={filteredAppointments}
            visibleStaffIds={visibleStaffIds}
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
         staff={mockStaff}
         services={mockServices}
         clients={mockClients}
         preselectedStaffId={preselectedStaffId}
         preselectedTime={preselectedTime}
         preselectedDate={todayStr}
         onSubmit={handleBookingSubmit}
        />

        <AppointmentDetailSheet
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          appointment={selectedAppointment}
          staff={mockStaff}
          services={mockServices}
          clients={mockClients}
          onUpdate={handleAppointmentUpdate}
          onStatusChange={handleStatusChange}
        />
      </div>
   );
 }