 import { Calendar } from '@/components/ui/calendar';
 
 interface MiniCalendarProps {
   date: Date;
   onDateSelect: (date: Date | undefined) => void;
 }
 
 export function MiniCalendar({ date, onDateSelect }: MiniCalendarProps) {
   return (
     <div className="p-2">
       <Calendar
         mode="single"
         selected={date}
         onSelect={onDateSelect}
         className="rounded-md border"
       />
     </div>
   );
 }