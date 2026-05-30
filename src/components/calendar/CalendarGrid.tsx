 import { DndContext, DragEndEvent, DragOverlay, pointerWithin, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
 import { Staff, Appointment } from '@/types/calendar';
 import { StaffColumn } from './StaffColumn';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
 import { AppointmentCard } from './AppointmentCard';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
 
 interface CalendarGridProps {
   staff: Staff[];
   appointments: Appointment[];
   visibleStaffIds: string[];
   startHour: number;
   endHour: number;
  view: 'day' | 'week' | 'month';
  date: Date;
  onSlotClick: (staffId: string, time: string) => void;
  onAppointmentMove: (appointmentId: string, newStaffId: string, newTime: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
 }
 
 const SLOT_HEIGHT = 60; // pixels per hour
 
 export function CalendarGrid({
   staff,
   appointments,
   visibleStaffIds,
   startHour,
   endHour,
  view,
  date,
  onSlotClick,
  onAppointmentMove,
  onAppointmentClick,
}: CalendarGridProps) {
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
    const [now, setNow] = useState(new Date());
    const { toast } = useToast();

    // Activation distance prevents a plain click from being interpreted
    // as a drag — so AppointmentCard onClick can fire and open the sheet.
    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor),
    );

    useEffect(() => {
      const timer = setInterval(() => setNow(new Date()), 60000);
      return () => clearInterval(timer);
    }, []);
 
   const visibleStaff = staff.filter((s) => visibleStaffIds.includes(s.id));
 
  // For week/month views, render different components
  if (view === 'week') {
    return (
      <WeekView
        staff={staff}
        appointments={appointments}
        visibleStaffIds={visibleStaffIds}
        startHour={startHour}
        endHour={endHour}
        date={date}
        onSlotClick={onSlotClick}
        onAppointmentClick={onAppointmentClick}
      />
    );
  }

  if (view === 'month') {
    return (
      <MonthView
        appointments={appointments}
        date={date}
        onDateClick={(clickedDate) => onSlotClick(visibleStaffIds[0] || '', '09:00')}
        onAppointmentClick={onAppointmentClick}
      />
    );
  }

   // Generate 15-minute time slots
   const timeSlots: string[] = [];
   for (let h = startHour; h < endHour; h++) {
     for (let m = 0; m < 60; m += 15) {
       timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
     }
   }
 
   const handleDragStart = (event: any) => {
     const apt = event.active.data.current as Appointment;
     setActiveAppointment(apt);
   };
 
   const handleDragEnd = (event: DragEndEvent) => {
     setActiveAppointment(null);
     
     const { active, over } = event;
     if (!over) return;
 
     const appointment = active.data.current as Appointment;
     const dropZoneId = over.id as string;
     
     // Extract staff ID from drop zone
     if (dropZoneId.startsWith('column-')) {
       const newStaffId = dropZoneId.replace('column-', '');
       const targetStaff = staff.find(s => s.id === newStaffId);
       
       if (!targetStaff) return;
 
       // Calculate new time based on drop position
       const dropY = event.delta.y;
       const minutesDelta = Math.round(dropY / (SLOT_HEIGHT / 60) / 15) * 15;
       
       const [oldH, oldM] = appointment.startTime.split(':').map(Number);
       const oldMinutes = oldH * 60 + oldM;
       const newMinutes = Math.max(startHour * 60, Math.min((endHour - 1) * 60, oldMinutes + minutesDelta));
       
       const newH = Math.floor(newMinutes / 60);
       const newM = newMinutes % 60;
       const newTime = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
 
       // Check for conflicts
       const hasConflict = appointments.some(apt => {
         if (apt.id === appointment.id) return false;
         if (apt.staffId !== newStaffId) return false;
         
         const [aptH, aptM] = apt.startTime.split(':').map(Number);
         const aptStart = aptH * 60 + aptM;
         const aptEnd = aptStart + apt.duration;
         const newStart = newMinutes;
         const newEnd = newStart + appointment.duration;
         
         return (newStart < aptEnd && newEnd > aptStart);
       });
 
       if (hasConflict) {
         toast({
           title: 'Scheduling Conflict',
           description: `Cannot move appointment - ${targetStaff.name} already has a booking at this time.`,
           variant: 'destructive',
         });
         return;
       }
 
       onAppointmentMove(appointment.id, newStaffId, newTime);
       
       toast({
         title: 'Appointment Moved',
         description: `${appointment.clientName}'s appointment moved to ${targetStaff.name} at ${newTime}`,
       });
     }
   };
 
   const totalHours = endHour - startHour;
 
   return (
     <DndContext
       collisionDetection={pointerWithin}
       onDragStart={handleDragStart}
       onDragEnd={handleDragEnd}
     >
      <div className="flex-1 flex overflow-auto relative">
          {/* Time Gutter */}
         <div className="w-16 flex-shrink-0 border-r bg-muted/30">
           <div className="h-[52px] border-b" /> {/* Header spacer */}
           <div className="relative" style={{ height: `${totalHours * SLOT_HEIGHT}px` }}>
             {Array.from({ length: totalHours + 1 }).map((_, idx) => (
               <div
                 key={idx}
                 className="absolute left-0 right-0 flex items-start justify-end pr-2 -mt-2 text-xs text-muted-foreground"
                 style={{ top: `${idx * SLOT_HEIGHT}px` }}
               >
                 {`${(startHour + idx).toString().padStart(2, '0')}:00`}
               </div>
             ))}
           </div>
         </div>
 
         {/* Staff Columns */}
          {visibleStaff.map((member) => (
            <StaffColumn
              key={member.id}
              staff={member}
              appointments={appointments.filter((a) => a.staffId === member.id)}
              timeSlots={timeSlots}
              startHour={startHour}
              endHour={endHour}
              slotHeight={SLOT_HEIGHT}
              onSlotClick={onSlotClick}
              onAppointmentClick={onAppointmentClick}
            />
          ))}
 
          {/* Current Time Indicator */}
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const viewDateStr = date.toISOString().split('T')[0];
            if (todayStr !== viewDateStr) return null;
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const startMinutes = startHour * 60;
            const endMinutes = endHour * 60;
            if (currentMinutes < startMinutes || currentMinutes > endMinutes) return null;
            const top = ((currentMinutes - startMinutes) / 60) * SLOT_HEIGHT + 52;
            return (
              <div className="absolute left-16 right-0 z-30 pointer-events-none flex items-center" style={{ top: `${top}px` }}>
                <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1.5 shrink-0" />
                <div className="flex-1 h-0.5 bg-destructive" />
              </div>
            );
          })()}

          {visibleStaff.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Select staff members from the sidebar to view their schedules</p>
            </div>
          )}
       </div>
 
       <DragOverlay>
         {activeAppointment && (
           <div
             className="rounded-md px-2 py-1 text-white shadow-lg"
             style={{
               backgroundColor: `hsl(${activeAppointment.serviceCategory === 'hair' ? '340, 82%, 52%' : '280, 68%, 60%'})`,
               width: '160px',
             }}
           >
             <p className="text-xs font-semibold">{activeAppointment.clientName}</p>
             <p className="text-xs opacity-90">{activeAppointment.serviceName}</p>
           </div>
         )}
       </DragOverlay>
     </DndContext>
   );
 }