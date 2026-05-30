import { useState, useEffect } from 'react';
import { Staff, Appointment } from '@/types/calendar';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { STATUS_META } from './statusMeta';
 
 interface WeekViewProps {
   staff: Staff[];
   appointments: Appointment[];
   visibleStaffIds: string[];
   startHour: number;
   endHour: number;
   date: Date;
   onSlotClick: (staffId: string, time: string) => void;
 }
 
 const SLOT_HEIGHT = 48;
 
 export function WeekView({
   staff,
   appointments,
   visibleStaffIds,
   startHour,
   endHour,
   date,
   onSlotClick,
 }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const totalHours = endHour - startHour;
    const [now, setNow] = useState(new Date());

    useEffect(() => {
      const timer = setInterval(() => setNow(new Date()), 60000);
      return () => clearInterval(timer);
    }, []);
 
   const getAppointmentsForDay = (day: Date) => {
     const dayStr = format(day, 'yyyy-MM-dd');
     return appointments.filter(
       (apt) => apt.date === dayStr && visibleStaffIds.includes(apt.staffId)
     );
   };
 
   const getAppointmentStyle = (apt: Appointment) => {
     const [startH, startM] = apt.startTime.split(':').map(Number);
     const startMinutes = (startH - startHour) * 60 + startM;
     const top = (startMinutes / 60) * SLOT_HEIGHT;
     const height = (apt.duration / 60) * SLOT_HEIGHT;
     return { top: `${top}px`, height: `${height}px` };
   };
 
   const getStaffForAppointment = (apt: Appointment) => {
     return staff.find((s) => s.id === apt.staffId);
   };
 
   return (
     <div className="flex-1 flex overflow-auto">
       {/* Time Gutter */}
       <div className="w-16 flex-shrink-0 border-r bg-muted/30">
         <div className="h-[52px] border-b" />
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
 
       {/* Day Columns */}
       {weekDays.map((day) => {
         const dayAppointments = getAppointmentsForDay(day);
         const isToday = isSameDay(day, new Date());
 
         return (
           <div key={day.toISOString()} className="flex flex-col min-w-[120px] flex-1 border-r">
             {/* Day Header */}
             <div
               className={cn(
                 'sticky top-0 z-10 px-2 py-2 border-b bg-card text-center',
                 isToday && 'bg-primary/10'
               )}
             >
               <p className="text-xs text-muted-foreground">{format(day, 'EEE')}</p>
               <p
                 className={cn(
                   'text-lg font-semibold',
                   isToday && 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto'
                 )}
               >
                 {format(day, 'd')}
               </p>
             </div>
 
             {/* Time Grid */}
             <div
               className="relative"
               style={{ height: `${totalHours * SLOT_HEIGHT}px` }}
             >
               {/* Hour lines */}
               {Array.from({ length: totalHours + 1 }).map((_, idx) => (
                 <div
                   key={idx}
                   className="absolute left-0 right-0 border-t border-border"
                   style={{ top: `${idx * SLOT_HEIGHT}px` }}
                 />
               ))}
 
               {/* Appointments */}
               {dayAppointments.map((apt) => {
                 const staffMember = getStaffForAppointment(apt);
                 return (
                   <div
                     key={apt.id}
                     className="absolute left-1 right-1 rounded px-1 py-0.5 text-white text-xs overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                     style={{
                       ...getAppointmentStyle(apt),
                       backgroundColor: staffMember?.color || 'hsl(var(--primary))',
                     }}
                     onClick={() => onSlotClick(apt.staffId, apt.startTime)}
                   >
                     <p className="font-medium truncate">{apt.clientName}</p>
                     <p className="truncate opacity-80">{apt.serviceName}</p>
                   </div>
                 );
                })}

                {/* Current Time Indicator */}
                {isToday && (() => {
                  const currentMinutes = now.getHours() * 60 + now.getMinutes();
                  const startMinutes = startHour * 60;
                  const endMinutes = endHour * 60;
                  if (currentMinutes < startMinutes || currentMinutes > endMinutes) return null;
                  const top = ((currentMinutes - startMinutes) / 60) * SLOT_HEIGHT;
                  return (
                    <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: `${top}px` }}>
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1 shrink-0" />
                      <div className="flex-1 h-0.5 bg-destructive" />
                    </div>
                  );
                })()}
              </div>
           </div>
         );
       })}
     </div>
   );
 }