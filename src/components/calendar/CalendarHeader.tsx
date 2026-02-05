 import { Button } from '@/components/ui/button';
 import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft } from 'lucide-react';
 import { format, addDays, subDays } from 'date-fns';
 
 interface CalendarHeaderProps {
   date: Date;
   view: 'day' | 'week' | 'month';
   sidebarCollapsed: boolean;
   onDateChange: (date: Date) => void;
   onViewChange: (view: 'day' | 'week' | 'month') => void;
   onToggleSidebar: () => void;
 }
 
 export function CalendarHeader({
   date,
   view,
   sidebarCollapsed,
   onDateChange,
   onViewChange,
   onToggleSidebar,
 }: CalendarHeaderProps) {
   const handlePrevious = () => {
     if (view === 'day') onDateChange(subDays(date, 1));
     else if (view === 'week') onDateChange(subDays(date, 7));
     else onDateChange(subDays(date, 30));
   };
 
   const handleNext = () => {
     if (view === 'day') onDateChange(addDays(date, 1));
     else if (view === 'week') onDateChange(addDays(date, 7));
     else onDateChange(addDays(date, 30));
   };
 
   const handleToday = () => onDateChange(new Date());
 
   return (
     <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
       <div className="flex items-center gap-2">
         <Button
           variant="ghost"
           size="icon"
           onClick={onToggleSidebar}
           className="mr-2"
         >
           {sidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
         </Button>
         
         <Button variant="outline" size="sm" onClick={handleToday}>
           Today
         </Button>
         
         <div className="flex items-center">
           <Button variant="ghost" size="icon" onClick={handlePrevious}>
             <ChevronLeft className="h-4 w-4" />
           </Button>
           <Button variant="ghost" size="icon" onClick={handleNext}>
             <ChevronRight className="h-4 w-4" />
           </Button>
         </div>
         
         <h2 className="text-lg font-semibold ml-2">
           {format(date, 'EEEE, MMMM d, yyyy')}
         </h2>
       </div>
 
       <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
         {(['day', 'week', 'month'] as const).map((v) => (
           <Button
             key={v}
             variant={view === v ? 'default' : 'ghost'}
             size="sm"
             onClick={() => onViewChange(v)}
             className="capitalize"
           >
             {v}
           </Button>
         ))}
       </div>
     </div>
   );
 }