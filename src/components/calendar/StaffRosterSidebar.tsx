 import { Staff } from '@/types/calendar';
 import { MiniCalendar } from './MiniCalendar';
 import { Avatar, AvatarFallback } from '@/components/ui/avatar';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Badge } from '@/components/ui/badge';
 import { cn } from '@/lib/utils';
 
 interface StaffRosterSidebarProps {
   staff: Staff[];
   visibleStaffIds: string[];
   collapsed: boolean;
   date: Date;
   onDateSelect: (date: Date | undefined) => void;
   onToggleStaff: (staffId: string) => void;
 }
 
 const statusColors: Record<Staff['status'], string> = {
   available: 'bg-green-500',
   busy: 'bg-yellow-500',
   break: 'bg-orange-500',
   off: 'bg-muted',
 };
 
 export function StaffRosterSidebar({
   staff,
   visibleStaffIds,
   collapsed,
   date,
   onDateSelect,
   onToggleStaff,
 }: StaffRosterSidebarProps) {
   if (collapsed) return null;
 
   return (
     <div className="w-64 border-r bg-card flex flex-col h-full">
       <MiniCalendar date={date} onDateSelect={onDateSelect} />
       
       <div className="flex-1 overflow-auto">
         <div className="px-3 py-2 border-b">
           <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
             Staff ({visibleStaffIds.length}/{staff.length})
           </h3>
         </div>
         
         <div className="p-2 space-y-1">
           {staff.map((member) => {
             const isVisible = visibleStaffIds.includes(member.id);
             return (
               <div
                 key={member.id}
                 className={cn(
                   'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                   isVisible ? 'bg-accent' : 'hover:bg-accent/50'
                 )}
                 onClick={() => onToggleStaff(member.id)}
               >
                 <Checkbox
                   checked={isVisible}
                   onCheckedChange={() => onToggleStaff(member.id)}
                   className="pointer-events-none"
                 />
                 
                 <Avatar className="h-8 w-8">
                   <AvatarFallback
                     style={{ backgroundColor: member.color }}
                     className="text-white text-xs font-medium"
                   >
                     {member.name.split(' ').map(n => n[0]).join('')}
                   </AvatarFallback>
                 </Avatar>
                 
                 <div className="flex-1 min-w-0">
                   <p className="text-sm font-medium truncate">{member.name}</p>
                   <p className="text-xs text-muted-foreground">
                     {member.workingHours.start} - {member.workingHours.end}
                   </p>
                 </div>
                 
                 <div className={cn('w-2 h-2 rounded-full', statusColors[member.status])} />
               </div>
             );
           })}
         </div>
       </div>
     </div>
   );
 }