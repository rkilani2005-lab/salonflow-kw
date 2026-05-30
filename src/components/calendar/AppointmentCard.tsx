import { Appointment, SERVICE_CATEGORY_COLORS } from '@/types/calendar';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { CreditCard, FileText, Users } from 'lucide-react';
 
interface AppointmentCardProps {
  appointment: Appointment;
  columnHeight: number;
  startHour: number;
  onAppointmentClick?: (appointment: Appointment) => void;
}
 
 const statusLabels: Record<Appointment['status'], string> = {
   planned: 'Planned',
   confirmed: 'Confirmed',
   checked_in: 'Checked In',
   in_service: 'In Service',
   completed: 'Completed',
   cancelled: 'Cancelled',
   no_show: 'No Show',
 };
 
 const statusColors: Record<Appointment['status'], string> = {
   planned: 'bg-muted text-muted-foreground',
   confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
   checked_in: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
   in_service: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
   completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
   cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
   no_show: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
 };
 
export function AppointmentCard({ appointment, columnHeight, startHour, onAppointmentClick }: AppointmentCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
     id: appointment.id,
     data: appointment,
   });
 
   // Calculate position based on time
   const [startH, startM] = appointment.startTime.split(':').map(Number);
   const startMinutes = (startH - startHour) * 60 + startM;
   const top = (startMinutes / 60) * columnHeight;
   const height = (appointment.duration / 60) * columnHeight;
 
   const style = {
     transform: CSS.Translate.toString(transform),
     top: `${top}px`,
     height: `${height}px`,
     backgroundColor: SERVICE_CATEGORY_COLORS[appointment.serviceCategory],
   };
 
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            style={style}
            className={cn(
              'absolute left-1 right-1 rounded-md px-2 py-1 cursor-grab active:cursor-grabbing',
              'text-white shadow-sm overflow-hidden transition-shadow',
              isDragging && 'opacity-50 shadow-lg z-50',
              appointment.groupId && 'ring-2 ring-white/60 ring-offset-1 ring-offset-transparent'
            )}
            {...listeners}
            {...attributes}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-1">
                <p className="text-xs font-semibold truncate flex-1">{appointment.clientName}</p>
                {appointment.groupId && (
                  <span className="shrink-0 w-4 h-4 rounded-full bg-white/30 flex items-center justify-center">
                    <Users className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
              <p className="text-xs opacity-90 truncate">{appointment.serviceName}</p>
              {height > 50 && (
                <p className="text-xs opacity-75 mt-auto">
                  {appointment.startTime} - {appointment.endTime}
                </p>
              )}
            </div>
          </div>
       </TooltipTrigger>
       <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-2">
            <div>
              <p className="font-semibold">{appointment.clientName}</p>
              <p className="text-sm text-muted-foreground">{appointment.serviceName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn('text-xs', statusColors[appointment.status])}>
                {statusLabels[appointment.status]}
              </Badge>
              <span className="text-sm">{appointment.price.toFixed(3)} KWD</span>
            </div>
           <p className="text-sm">
             {appointment.startTime} - {appointment.endTime} ({appointment.duration} min)
           </p>
           <div className="flex gap-2 mt-2">
             <Button
               size="sm"
               variant="outline"
               className="flex-1"
               onClick={(e) => {
                 e.stopPropagation();
                 onAppointmentClick?.(appointment);
               }}
             >
               <FileText className="mr-1 h-3 w-3" />
               Details
             </Button>
             {(appointment.status === 'completed' || appointment.status === 'in_service') && (
               <Button
                 size="sm"
                 className="flex-1"
                 onClick={(e) => {
                   e.stopPropagation();
                   navigate(`/pos?bookingId=${appointment.id}&from=calendar`, { state: { returnTo: '/calendar', fromAppointmentId: appointment.id } });
                 }}
               >
                 <CreditCard className="mr-1 h-3 w-3" />
                 Checkout
               </Button>
             )}
           </div>
         </div>
       </TooltipContent>
     </Tooltip>
   );
 }