 import { useState, useMemo } from 'react';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Card, CardContent } from '@/components/ui/card';
 import { Avatar, AvatarFallback } from '@/components/ui/avatar';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Search, Plus, Users, Clock, UserCheck } from 'lucide-react';
 import { useStaff } from '@/hooks/useStaff';
 import AddStaffDialog from '@/components/staff/AddStaffDialog';
 import StaffDetailSheet from '@/components/staff/StaffDetailSheet';
 import { useDebounce } from '@/hooks/useDebounce';
 
 const Staff = () => {
   const [searchInput, setSearchInput] = useState('');
   const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
   const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
   const [isDetailOpen, setIsDetailOpen] = useState(false);
 
   const debouncedSearch = useDebounce(searchInput, 300);
   const { data: staff, isLoading } = useStaff(debouncedSearch);
 
   const stats = useMemo(() => {
     if (!staff) return { total: 0, active: 0 };
     return {
       total: staff.length,
       active: staff.filter(s => s.is_active).length,
     };
   }, [staff]);
 
   const handleCardClick = (staffId: string) => {
     setSelectedStaffId(staffId);
     setIsDetailOpen(true);
   };
 
   return (
     <div className="p-6 space-y-6">
       {/* Header */}
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
         <div>
           <h1 className="text-2xl font-bold">Staff</h1>
           <p className="text-muted-foreground">Manage your team members and their schedules</p>
         </div>
         <Button onClick={() => setIsAddDialogOpen(true)}>
           <Plus className="h-4 w-4 mr-2" />
           Add Staff
         </Button>
       </div>
 
       {/* Stats Cards */}
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
               <Users className="h-5 w-5" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.total}</p>
               <p className="text-sm text-muted-foreground">Total Staff</p>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
               <UserCheck className="h-5 w-5 text-primary" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.active}</p>
               <p className="text-sm text-muted-foreground">Active Staff</p>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Search */}
       <div className="relative max-w-md">
         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
         <Input
           placeholder="Search by name, email, or phone..."
           value={searchInput}
           onChange={(e) => setSearchInput(e.target.value)}
           className="pl-10"
         />
       </div>
 
       {/* Staff Grid */}
       {isLoading ? (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {[...Array(6)].map((_, i) => (
             <Skeleton key={i} className="h-40 w-full" />
           ))}
         </div>
       ) : staff?.length === 0 ? (
         <Card>
           <CardContent className="text-center py-12">
             <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
             <h3 className="font-medium mb-1">No staff found</h3>
             <p className="text-sm text-muted-foreground mb-4">
               {searchInput ? 'Try adjusting your search' : 'Add your first team member to get started'}
             </p>
             {!searchInput && (
               <Button onClick={() => setIsAddDialogOpen(true)}>
                 <Plus className="h-4 w-4 mr-2" />
                 Add Staff
               </Button>
             )}
           </CardContent>
         </Card>
       ) : (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {staff?.map((member) => (
             <Card
               key={member.id}
               className="cursor-pointer hover:shadow-md transition-shadow"
               onClick={() => handleCardClick(member.id)}
             >
               <CardContent className="p-4">
                 <div className="flex items-start gap-4">
                   <Avatar className="h-12 w-12">
                     <AvatarFallback
                       style={{ backgroundColor: member.color || '#6366f1' }}
                       className="text-white font-semibold"
                     >
                       {member.name.charAt(0).toUpperCase()}
                     </AvatarFallback>
                   </Avatar>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center justify-between gap-2">
                       <h3 className="font-semibold truncate">{member.name}</h3>
                       <Badge variant={member.is_active ? 'default' : 'secondary'} className="shrink-0">
                         {member.is_active ? 'Active' : 'Inactive'}
                       </Badge>
                     </div>
                     {member.name_ar && (
                       <p className="text-sm text-muted-foreground truncate" dir="rtl">
                         {member.name_ar}
                       </p>
                     )}
                   </div>
                 </div>
 
                 <div className="mt-4 pt-4 border-t space-y-2">
                   <div className="flex items-center gap-2 text-sm text-muted-foreground">
                     <Clock className="h-4 w-4" />
                     <span>
                       {member.working_hours_start} - {member.working_hours_end}
                     </span>
                   </div>
                   {member.break_start && member.break_end && (
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                       <span className="ml-6">Break: {member.break_start} - {member.break_end}</span>
                     </div>
                   )}
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>
       )}
 
       {/* Dialogs */}
       <AddStaffDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
       <StaffDetailSheet
         staffId={selectedStaffId}
         open={isDetailOpen}
         onOpenChange={setIsDetailOpen}
       />
     </div>
   );
 };
 
 export default Staff;