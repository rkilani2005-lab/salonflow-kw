 import { useEffect, useState } from 'react';
 import { useForm } from 'react-hook-form';
 import { zodResolver } from '@hookform/resolvers/zod';
 import * as z from 'zod';
 import { StaffCommissionRules } from './StaffCommissionRules';
 import { useAuth } from '@/contexts/AuthContext';
 import {
   Sheet,
   SheetContent,
   SheetHeader,
   SheetTitle,
 } from '@/components/ui/sheet';
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from '@/components/ui/alert-dialog';
 import {
   Form,
   FormControl,
   FormField,
   FormItem,
   FormLabel,
   FormMessage,
 } from '@/components/ui/form';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Badge } from '@/components/ui/badge';
 import { Switch } from '@/components/ui/switch';
 import { Skeleton } from '@/components/ui/skeleton';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Avatar, AvatarFallback } from '@/components/ui/avatar';
 import { Clock, Coffee, Briefcase, Mail, Phone, Palette, Trash2 } from 'lucide-react';
 import { useStaffWithServices, useUpdateStaff, useDeleteStaff, useServices } from '@/hooks/useStaff';
 
 const formSchema = z.object({
   name: z.string().min(2),
   name_ar: z.string().optional(),
   email: z.string().email().optional().or(z.literal('')),
   phone: z.string().optional(),
   color: z.string().optional(),
   working_hours_start: z.string(),
   working_hours_end: z.string(),
   break_start: z.string().optional(),
   break_end: z.string().optional(),
   is_active: z.boolean(),
   serviceIds: z.array(z.string()),
 });
 
 type FormData = z.infer<typeof formSchema>;
 
 interface StaffDetailSheetProps {
   staffId: string | null;
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const StaffDetailSheet = ({ staffId, open, onOpenChange }: StaffDetailSheetProps) => {
   const [isEditing, setIsEditing] = useState(false);
   const [showDeleteDialog, setShowDeleteDialog] = useState(false);
   const { data: staff, isLoading } = useStaffWithServices(staffId);
   const { tenant } = useAuth();
   const currency = tenant?.currency || 'KWD';
   const { data: allServices } = useServices();
   const updateStaff = useUpdateStaff();
   const deleteStaff = useDeleteStaff();
 
   const form = useForm<FormData>({
     resolver: zodResolver(formSchema),
     defaultValues: {
       name: '',
       name_ar: '',
       email: '',
       phone: '',
       color: '#6366f1',
       working_hours_start: '09:00',
       working_hours_end: '18:00',
       break_start: '',
       break_end: '',
       is_active: true,
       serviceIds: [],
     },
   });
 
   useEffect(() => {
     if (staff) {
       form.reset({
         name: staff.name,
         name_ar: staff.name_ar || '',
         email: staff.email || '',
         phone: staff.phone || '',
         color: staff.color || '#6366f1',
         working_hours_start: staff.working_hours_start,
         working_hours_end: staff.working_hours_end,
         break_start: staff.break_start || '',
         break_end: staff.break_end || '',
         is_active: staff.is_active,
         serviceIds: staff.services.map(s => s.id),
       });
     }
   }, [staff, form]);
 
   const onSubmit = async (data: FormData) => {
     if (!staffId) return;
     await updateStaff.mutateAsync({
       id: staffId,
       ...data,
       email: data.email || null,
       break_start: data.break_start || null,
       break_end: data.break_end || null,
     });
     setIsEditing(false);
   };
 
   const handleClose = () => {
     setIsEditing(false);
     setShowDeleteDialog(false);
     onOpenChange(false);
   };
 
   const handleDelete = async () => {
     if (!staffId) return;
     await deleteStaff.mutateAsync(staffId);
     handleClose();
   };
 
   if (!staffId) return null;
 
   return (
     <Sheet open={open} onOpenChange={handleClose}>
       <SheetContent className="w-full sm:max-w-lg">
         <SheetHeader>
           <SheetTitle>Staff Details</SheetTitle>
         </SheetHeader>
 
         {isLoading ? (
           <div className="space-y-4 mt-6">
             <Skeleton className="h-20 w-full" />
             <Skeleton className="h-40 w-full" />
           </div>
         ) : staff ? (
           <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
             {!isEditing ? (
               <div className="space-y-6 mt-6">
                 {/* Profile Header */}
                 <div className="flex items-center gap-4">
                   <Avatar className="h-16 w-16">
                     <AvatarFallback
                       style={{ backgroundColor: staff.color || '#6366f1' }}
                       className="text-white text-xl font-semibold"
                     >
                       {staff.name.charAt(0).toUpperCase()}
                     </AvatarFallback>
                   </Avatar>
                   <div className="flex-1">
                     <h3 className="text-lg font-semibold">{staff.name}</h3>
                     {staff.name_ar && (
                       <p className="text-muted-foreground" dir="rtl">{staff.name_ar}</p>
                     )}
                     <Badge variant={staff.is_active ? 'default' : 'secondary'}>
                       {staff.is_active ? 'Active' : 'Inactive'}
                     </Badge>
                   </div>
                 </div>
 
                 {/* Contact Info */}
                 <div className="space-y-3">
                   <h4 className="text-sm font-medium text-muted-foreground">Contact</h4>
                   <div className="space-y-2">
                     {staff.email && (
                       <div className="flex items-center gap-2 text-sm">
                         <Mail className="h-4 w-4 text-muted-foreground" />
                         {staff.email}
                       </div>
                     )}
                     {staff.phone && (
                       <div className="flex items-center gap-2 text-sm">
                         <Phone className="h-4 w-4 text-muted-foreground" />
                         {staff.phone}
                       </div>
                     )}
                     <div className="flex items-center gap-2 text-sm">
                       <Palette className="h-4 w-4 text-muted-foreground" />
                       <span
                         className="w-4 h-4 rounded"
                         style={{ backgroundColor: staff.color || '#6366f1' }}
                       />
                       {staff.color}
                     </div>
                   </div>
                 </div>
 
                 {/* Working Hours */}
                 <div className="space-y-3">
                   <h4 className="text-sm font-medium text-muted-foreground">Schedule</h4>
                   <div className="grid grid-cols-2 gap-4">
                     <div className="p-3 rounded-lg bg-muted/50">
                       <div className="flex items-center gap-2 text-sm font-medium mb-1">
                         <Clock className="h-4 w-4" />
                         Working Hours
                       </div>
                       <p className="text-sm text-muted-foreground">
                         {staff.working_hours_start} - {staff.working_hours_end}
                       </p>
                     </div>
                     {staff.break_start && staff.break_end && (
                       <div className="p-3 rounded-lg bg-muted/50">
                         <div className="flex items-center gap-2 text-sm font-medium mb-1">
                           <Coffee className="h-4 w-4" />
                           Break Time
                         </div>
                         <p className="text-sm text-muted-foreground">
                           {staff.break_start} - {staff.break_end}
                         </p>
                       </div>
                     )}
                   </div>
                 </div>
 
                 {/* Service Skills */}
                 <div className="space-y-3">
                   <div className="flex items-center gap-2">
                     <Briefcase className="h-4 w-4 text-muted-foreground" />
                     <h4 className="text-sm font-medium text-muted-foreground">Service Skills</h4>
                   </div>
                   <div className="flex flex-wrap gap-2">
                     {staff.services.length > 0 ? (
                       staff.services.map((service) => (
                         <Badge
                           key={service.id}
                           variant="outline"
                           className="flex items-center gap-1"
                         >
                           <span
                             className="w-2 h-2 rounded-full"
                             style={{ backgroundColor: service.color || '#6366f1' }}
                           />
                           {service.name}
                         </Badge>
                       ))
                     ) : (
                       <p className="text-sm text-muted-foreground">No services assigned</p>
                     )}
                   </div>
                 </div>
 
                 {/* Commission Rules */}
                 {staffId && (
                   <div className="pt-2">
                     <StaffCommissionRules
                       staffId={staffId}
                       staffName={staff?.name || ''}
                       currency={currency}
                     />
                   </div>
                 )}

                 <Button onClick={() => setIsEditing(true)} className="w-full">
                   Edit Staff
                 </Button>
                   <Button 
                     variant="outline" 
                     className="w-full text-destructive hover:text-destructive"
                     onClick={() => setShowDeleteDialog(true)}
                   >
                     <Trash2 className="h-4 w-4 mr-2" />
                     Delete Staff
                   </Button>
               </div>
             ) : (
               <Form {...form}>
                 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                   <div className="grid grid-cols-2 gap-4">
                     <FormField
                       control={form.control}
                       name="name"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Name (English)</FormLabel>
                           <FormControl>
                             <Input {...field} />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                     <FormField
                       control={form.control}
                       name="name_ar"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Name (Arabic)</FormLabel>
                           <FormControl>
                             <Input dir="rtl" {...field} />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                   </div>
 
                   <div className="grid grid-cols-2 gap-4">
                     <FormField
                       control={form.control}
                       name="email"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Email</FormLabel>
                           <FormControl>
                             <Input type="email" {...field} />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                     <FormField
                       control={form.control}
                       name="phone"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Phone</FormLabel>
                           <FormControl>
                             <Input {...field} />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                   </div>
 
                   <FormField
                     control={form.control}
                     name="color"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Calendar Color</FormLabel>
                         <FormControl>
                           <div className="flex items-center gap-2">
                             <input
                               type="color"
                               value={field.value}
                               onChange={field.onChange}
                               className="h-10 w-14 rounded border cursor-pointer"
                             />
                             <Input {...field} className="flex-1" />
                           </div>
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
 
                   <div className="space-y-2">
                     <h4 className="text-sm font-medium">Working Hours</h4>
                     <div className="grid grid-cols-2 gap-4">
                       <FormField
                         control={form.control}
                         name="working_hours_start"
                         render={({ field }) => (
                           <FormItem>
                             <FormLabel>Start</FormLabel>
                             <FormControl>
                               <Input type="time" {...field} />
                             </FormControl>
                             <FormMessage />
                           </FormItem>
                         )}
                       />
                       <FormField
                         control={form.control}
                         name="working_hours_end"
                         render={({ field }) => (
                           <FormItem>
                             <FormLabel>End</FormLabel>
                             <FormControl>
                               <Input type="time" {...field} />
                             </FormControl>
                             <FormMessage />
                           </FormItem>
                         )}
                       />
                     </div>
                   </div>
 
                   <div className="space-y-2">
                     <h4 className="text-sm font-medium">Break Time</h4>
                     <div className="grid grid-cols-2 gap-4">
                       <FormField
                         control={form.control}
                         name="break_start"
                         render={({ field }) => (
                           <FormItem>
                             <FormLabel>Start</FormLabel>
                             <FormControl>
                               <Input type="time" {...field} />
                             </FormControl>
                             <FormMessage />
                           </FormItem>
                         )}
                       />
                       <FormField
                         control={form.control}
                         name="break_end"
                         render={({ field }) => (
                           <FormItem>
                             <FormLabel>End</FormLabel>
                             <FormControl>
                               <Input type="time" {...field} />
                             </FormControl>
                             <FormMessage />
                           </FormItem>
                         )}
                       />
                     </div>
                   </div>
 
                   <FormField
                     control={form.control}
                     name="is_active"
                     render={({ field }) => (
                       <FormItem className="flex items-center justify-between rounded-lg border p-3">
                         <div>
                           <FormLabel className="text-base">Active Status</FormLabel>
                           <p className="text-sm text-muted-foreground">
                             Inactive staff won't appear in booking
                           </p>
                         </div>
                         <FormControl>
                           <Switch checked={field.value} onCheckedChange={field.onChange} />
                         </FormControl>
                       </FormItem>
                     )}
                   />
 
                   <div className="space-y-2">
                     <h4 className="text-sm font-medium">Service Skills</h4>
                     <FormField
                       control={form.control}
                       name="serviceIds"
                       render={({ field }) => (
                         <FormItem>
                           <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                             {allServices?.map((service) => (
                               <label
                                 key={service.id}
                                 className="flex items-center gap-2 text-sm cursor-pointer"
                               >
                                 <Checkbox
                                   checked={field.value?.includes(service.id)}
                                   onCheckedChange={(checked) => {
                                     if (checked) {
                                       field.onChange([...field.value, service.id]);
                                     } else {
                                       field.onChange(field.value.filter((id) => id !== service.id));
                                     }
                                   }}
                                 />
                                 <span
                                   className="w-2 h-2 rounded-full"
                                   style={{ backgroundColor: service.color || '#6366f1' }}
                                 />
                                 {service.name}
                               </label>
                             ))}
                           </div>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                   </div>
 
                   <div className="flex gap-2 pt-4">
                     <Button
                       type="button"
                       variant="outline"
                       onClick={() => setIsEditing(false)}
                       className="flex-1"
                     >
                       Cancel
                     </Button>
                     <Button type="submit" disabled={updateStaff.isPending} className="flex-1">
                       {updateStaff.isPending ? 'Saving...' : 'Save Changes'}
                     </Button>
                   </div>
                 </form>
               </Form>
             )}
           </ScrollArea>
         ) : null}
       </SheetContent>
       
       <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
             <AlertDialogDescription>
               Are you sure you want to delete <span className="font-semibold">{staff?.name}</span>? 
               This action cannot be undone. All service skill assignments will also be removed.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction
               onClick={handleDelete}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
               disabled={deleteStaff.isPending}
             >
               {deleteStaff.isPending ? 'Deleting...' : 'Delete'}
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </Sheet>
   );
 };
 
 export default StaffDetailSheet;