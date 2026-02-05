 import { useState } from 'react';
 import { useForm } from 'react-hook-form';
 import { zodResolver } from '@hookform/resolvers/zod';
 import * as z from 'zod';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
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
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { useCreateStaff, useServices } from '@/hooks/useStaff';
 
 const formSchema = z.object({
   name: z.string().min(2, 'Name must be at least 2 characters'),
   name_ar: z.string().optional(),
   email: z.string().email().optional().or(z.literal('')),
   phone: z.string().optional(),
   color: z.string().optional(),
   working_hours_start: z.string().default('09:00'),
   working_hours_end: z.string().default('18:00'),
   break_start: z.string().optional(),
   break_end: z.string().optional(),
   serviceIds: z.array(z.string()).default([]),
 });
 
 type FormData = z.infer<typeof formSchema>;
 
 interface AddStaffDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const AddStaffDialog = ({ open, onOpenChange }: AddStaffDialogProps) => {
   const createStaff = useCreateStaff();
   const { data: services } = useServices();
 
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
       serviceIds: [],
     },
   });
 
   const onSubmit = async (data: FormData) => {
     await createStaff.mutateAsync({
       name: data.name,
       name_ar: data.name_ar,
       phone: data.phone,
       color: data.color,
       working_hours_start: data.working_hours_start,
       working_hours_end: data.working_hours_end,
       email: data.email || undefined,
       break_start: data.break_start || undefined,
       break_end: data.break_end || undefined,
       serviceIds: data.serviceIds,
     });
     form.reset();
     onOpenChange(false);
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-lg max-h-[90vh]">
         <DialogHeader>
           <DialogTitle>Add Staff Member</DialogTitle>
         </DialogHeader>
         <ScrollArea className="max-h-[70vh] pr-4">
           <Form {...form}>
             <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <FormField
                   control={form.control}
                   name="name"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Name (English)</FormLabel>
                       <FormControl>
                         <Input placeholder="John Doe" {...field} />
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
                         <Input placeholder="الاسم بالعربي" dir="rtl" {...field} />
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
                         <Input type="email" placeholder="email@example.com" {...field} />
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
                         <Input placeholder="+965 XXXX XXXX" {...field} />
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
                 <h4 className="text-sm font-medium">Break Time (Optional)</h4>
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
 
               <div className="space-y-2">
                 <h4 className="text-sm font-medium">Service Skills</h4>
                 <p className="text-xs text-muted-foreground">Select services this staff member can perform</p>
                 <FormField
                   control={form.control}
                   name="serviceIds"
                   render={({ field }) => (
                     <FormItem>
                       <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                         {services?.map((service) => (
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
                                   field.onChange(field.value.filter((id: string) => id !== service.id));
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
                         {!services?.length && (
                           <p className="col-span-2 text-sm text-muted-foreground">No services available</p>
                         )}
                       </div>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
               </div>
 
               <div className="flex justify-end gap-2 pt-4">
                 <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                   Cancel
                 </Button>
                 <Button type="submit" disabled={createStaff.isPending}>
                   {createStaff.isPending ? 'Adding...' : 'Add Staff'}
                 </Button>
               </div>
             </form>
           </Form>
         </ScrollArea>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default AddStaffDialog;