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
   FormDescription,
 } from '@/components/ui/form';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Switch } from '@/components/ui/switch';
 import { useCreateService, SERVICE_CATEGORIES, ServiceCategory } from '@/hooks/useServices';
 
 const formSchema = z.object({
   name: z.string().min(2, 'Name must be at least 2 characters'),
   name_ar: z.string().optional(),
   category: z.enum(['hair', 'nails', 'facial', 'makeup', 'waxing', 'massage', 'other'] as const),
   price: z.coerce.number().min(0, 'Price must be positive'),
   duration: z.coerce.number().min(5, 'Duration must be at least 5 minutes'),
   color: z.string().optional(),
   deposit_required: z.boolean().default(false),
   deposit_amount: z.coerce.number().min(0).optional(),
 });
 
 type FormData = z.infer<typeof formSchema>;
 
 interface AddServiceDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const AddServiceDialog = ({ open, onOpenChange }: AddServiceDialogProps) => {
   const createService = useCreateService();
 
   const form = useForm<FormData>({
     resolver: zodResolver(formSchema),
     defaultValues: {
       name: '',
       name_ar: '',
       category: 'other',
       price: 0,
       duration: 30,
       color: '#6366f1',
       deposit_required: false,
       deposit_amount: 0,
     },
   });
 
   const watchDepositRequired = form.watch('deposit_required');
 
   const onSubmit = async (data: FormData) => {
     await createService.mutateAsync({
       name: data.name,
       name_ar: data.name_ar,
       category: data.category as ServiceCategory,
       price: data.price,
       duration: data.duration,
       color: data.color,
       deposit_required: data.deposit_required,
       deposit_amount: data.deposit_required ? data.deposit_amount : 0,
     });
     form.reset();
     onOpenChange(false);
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-lg">
         <DialogHeader>
           <DialogTitle>Add Service</DialogTitle>
         </DialogHeader>
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
                       <Input placeholder="Haircut" {...field} />
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
                       <Input placeholder="قص شعر" dir="rtl" {...field} />
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )}
               />
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <FormField
                 control={form.control}
                 name="category"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>Category</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                       <FormControl>
                         <SelectTrigger>
                           <SelectValue placeholder="Select category" />
                         </SelectTrigger>
                       </FormControl>
                       <SelectContent>
                         {SERVICE_CATEGORIES.map((cat) => (
                           <SelectItem key={cat.value} value={cat.value}>
                             {cat.label}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                     <FormMessage />
                   </FormItem>
                 )}
               />
               <FormField
                 control={form.control}
                 name="color"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>Color</FormLabel>
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
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <FormField
                 control={form.control}
                 name="price"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>Price (KWD)</FormLabel>
                     <FormControl>
                       <Input type="number" step="0.5" min="0" {...field} />
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )}
               />
               <FormField
                 control={form.control}
                 name="duration"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>Duration (minutes)</FormLabel>
                     <FormControl>
                       <Input type="number" step="5" min="5" {...field} />
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )}
               />
             </div>
 
             <FormField
               control={form.control}
               name="deposit_required"
               render={({ field }) => (
                 <FormItem className="flex items-center justify-between rounded-lg border p-3">
                   <div>
                     <FormLabel className="text-base">Require Deposit</FormLabel>
                     <FormDescription>
                       Collect a deposit when booking online
                     </FormDescription>
                   </div>
                   <FormControl>
                     <Switch checked={field.value} onCheckedChange={field.onChange} />
                   </FormControl>
                 </FormItem>
               )}
             />
 
             {watchDepositRequired && (
               <FormField
                 control={form.control}
                 name="deposit_amount"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>Deposit Amount (KWD)</FormLabel>
                     <FormControl>
                       <Input type="number" step="0.5" min="0" {...field} />
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )}
               />
             )}
 
             <div className="flex justify-end gap-2 pt-4">
               <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                 Cancel
               </Button>
               <Button type="submit" disabled={createService.isPending}>
                 {createService.isPending ? 'Adding...' : 'Add Service'}
               </Button>
             </div>
           </form>
         </Form>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default AddServiceDialog;