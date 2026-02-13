 import { useDroppable } from '@dnd-kit/core';
 import { Staff, Appointment } from '@/types/calendar';
 import { AppointmentCard } from './AppointmentCard';
 import { Avatar, AvatarFallback } from '@/components/ui/avatar';
 import { cn } from '@/lib/utils';
 
interface StaffColumnProps {
  staff: Staff;
  appointments: Appointment[];
  timeSlots: string[];
  startHour: number;
  endHour: number;
  slotHeight: number;
  onSlotClick: (staffId: string, time: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
}
 
export function StaffColumn({
  staff,
  appointments,
  timeSlots,
  startHour,
  endHour,
  slotHeight,
  onSlotClick,
  onAppointmentClick,
}: StaffColumnProps) {
   const { setNodeRef, isOver } = useDroppable({
     id: `column-${staff.id}`,
     data: { staffId: staff.id },
   });
 
   const totalHours = endHour - startHour;
   const columnHeight = totalHours * slotHeight;
 
   // Check if a time is during staff working hours
   const isWorkingTime = (time: string) => {
     const [h] = time.split(':').map(Number);
     const [startH] = staff.workingHours.start.split(':').map(Number);
     const [endH] = staff.workingHours.end.split(':').map(Number);
     return h >= startH && h < endH;
   };
 
   // Check if a time is during break
   const isBreakTime = (time: string) => {
     if (!staff.breaks) return false;
     const [h, m] = time.split(':').map(Number);
     const timeMinutes = h * 60 + m;
     
     return staff.breaks.some(b => {
       const [bsH, bsM] = b.start.split(':').map(Number);
       const [beH, beM] = b.end.split(':').map(Number);
       const breakStart = bsH * 60 + bsM;
       const breakEnd = beH * 60 + beM;
       return timeMinutes >= breakStart && timeMinutes < breakEnd;
     });
   };
 
   return (
     <div className="flex flex-col min-w-[180px] flex-1">
       {/* Column Header */}
       <div
         className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b bg-card"
         style={{ borderLeftColor: staff.color, borderLeftWidth: 3 }}
       >
         <Avatar className="h-7 w-7">
           <AvatarFallback
             style={{ backgroundColor: staff.color }}
             className="text-white text-xs"
           >
             {staff.name.split(' ').map(n => n[0]).join('')}
           </AvatarFallback>
         </Avatar>
         <div className="min-w-0">
           <p className="text-sm font-medium truncate">{staff.name}</p>
           <p className="text-xs text-muted-foreground">
             {staff.workingHours.start} - {staff.workingHours.end}
           </p>
         </div>
       </div>
 
       {/* Time Grid */}
       <div
         ref={setNodeRef}
         className={cn(
           'relative border-l',
           isOver && 'bg-primary/5'
         )}
         style={{ height: `${columnHeight}px` }}
       >
         {/* Time slot backgrounds */}
         {timeSlots.map((time, idx) => {
           const working = isWorkingTime(time);
           const onBreak = isBreakTime(time);
           
           return (
             <div
               key={time}
               className={cn(
                 'absolute left-0 right-0 border-b border-dashed border-border/50',
                 !working && 'bg-muted/30',
                 onBreak && 'bg-orange-100/50 dark:bg-orange-900/20'
               )}
               style={{
                 top: `${idx * (slotHeight / 4)}px`,
                 height: `${slotHeight / 4}px`,
               }}
               onClick={() => working && !onBreak && onSlotClick(staff.id, time)}
             />
           );
         })}
 
         {/* Hour lines */}
         {Array.from({ length: totalHours + 1 }).map((_, idx) => (
           <div
             key={idx}
             className="absolute left-0 right-0 border-t border-border"
             style={{ top: `${idx * slotHeight}px` }}
           />
         ))}
 
         {/* Appointments */}
          {appointments.map((apt) => (
            <AppointmentCard
              key={apt.id}
              appointment={apt}
              columnHeight={slotHeight}
              startHour={startHour}
              onAppointmentClick={onAppointmentClick}
            />
          ))}
       </div>
     </div>
   );
 }