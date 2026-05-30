 import { Appointment } from '@/types/calendar';
 import {
   format,
   startOfMonth,
   endOfMonth,
   startOfWeek,
   endOfWeek,
   addDays,
   isSameMonth,
   isSameDay,
 } from 'date-fns';
 import { cn } from '@/lib/utils';
 import { STATUS_META } from './statusMeta';
 
 interface MonthViewProps {
   appointments: Appointment[];
   date: Date;
   onDateClick: (date: Date) => void;
 }
 
 export function MonthView({ appointments, date, onDateClick }: MonthViewProps) {
   const monthStart = startOfMonth(date);
   const monthEnd = endOfMonth(date);
   const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
   const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
 
   const weeks: Date[][] = [];
   let currentDay = calendarStart;
   while (currentDay <= calendarEnd) {
     const week: Date[] = [];
     for (let i = 0; i < 7; i++) {
       week.push(currentDay);
       currentDay = addDays(currentDay, 1);
     }
     weeks.push(week);
   }
 
   const getAppointmentsForDay = (day: Date) => {
     const dayStr = format(day, 'yyyy-MM-dd');
     return appointments.filter((apt) => apt.date === dayStr);
   };
 
   const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
 
   return (
     <div className="flex-1 flex flex-col overflow-auto p-4">
       {/* Week day headers */}
       <div className="grid grid-cols-7 gap-1 mb-2">
         {weekDays.map((day) => (
           <div
             key={day}
             className="text-center text-sm font-medium text-muted-foreground py-2"
           >
             {day}
           </div>
         ))}
       </div>
 
       {/* Calendar grid */}
       <div className="flex-1 grid grid-rows-[repeat(auto-fill,minmax(100px,1fr))] gap-1">
         {weeks.map((week, weekIdx) => (
           <div key={weekIdx} className="grid grid-cols-7 gap-1">
             {week.map((day) => {
               const dayAppointments = getAppointmentsForDay(day);
               const isCurrentMonth = isSameMonth(day, date);
               const isToday = isSameDay(day, new Date());
 
               return (
                 <div
                   key={day.toISOString()}
                   className={cn(
                     'min-h-[100px] border rounded-lg p-1 cursor-pointer hover:bg-accent/50 transition-colors',
                     !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                     isToday && 'border-primary border-2'
                   )}
                   onClick={() => onDateClick(day)}
                 >
                   <div
                     className={cn(
                       'text-sm font-medium mb-1',
                       isToday &&
                         'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                     )}
                   >
                     {format(day, 'd')}
                   </div>
 
                   {/* Appointment indicators */}
                   <div className="space-y-0.5 overflow-hidden">
                     {dayAppointments.slice(0, 3).map((apt) => (
                       <div
                         key={apt.id}
                         className="text-xs px-1 py-0.5 rounded truncate text-white"
                         style={{
                           backgroundColor:
                             apt.serviceCategory === 'hair'
                               ? 'hsl(340, 82%, 52%)'
                               : apt.serviceCategory === 'nails'
                               ? 'hsl(280, 68%, 60%)'
                               : 'hsl(200, 98%, 48%)',
                         }}
                       >
                         {apt.clientName}
                       </div>
                     ))}
                     {dayAppointments.length > 3 && (
                       <p className="text-xs text-muted-foreground">
                         +{dayAppointments.length - 3} more
                       </p>
                     )}
                   </div>
                 </div>
               );
             })}
           </div>
         ))}
       </div>
     </div>
   );
 }