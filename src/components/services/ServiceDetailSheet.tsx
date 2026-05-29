import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ServiceRecipeEditor } from './ServiceRecipeEditor';
import { ServiceUsageHistory } from './ServiceUsageHistory';
import { ServicePriceSchedules } from './ServicePriceSchedules';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet,
   SheetContent,
   SheetHeader,
   SheetTitle,
 } from '@/components/ui/sheet';
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
 import { Badge } from '@/components/ui/badge';
 import { Skeleton } from '@/components/ui/skeleton';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Clock, DollarSign, Tag, Palette, CreditCard } from 'lucide-react';
 import { useServiceById, useUpdateService, SERVICE_CATEGORIES, GL_CATEGORIES, ServiceCategory } from '@/hooks/useServices';
 import { useState } from 'react';
 
 const formSchema = z.object({
   name: z.string().min(2),
   name_ar: z.string().optional(),
   category: z.enum(['hair', 'nails', 'facial', 'makeup', 'waxing', 'massage', 'other'] as const),
   gl_category: z.string().default('other'),
   price: z.coerce.number().min(0),
   duration: z.coerce.number().min(5),
   color: z.string().optional(),
   deposit_required: z.boolean(),
   deposit_amount: z.coerce.number().min(0).optional(),
   is_active: z.boolean(),
 });
 
 type FormData = z.infer<typeof formSchema>;
 
 interface ServiceDetailSheetProps {
   serviceId: string | null;
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const ServiceDetailSheet = ({ serviceId, open, onOpenChange }: ServiceDetailSheetProps) => {
   const [isEditing, setIsEditing] = useState(false);
   const { data: service, isLoading } = useServiceById(serviceId);
   const updateService = useUpdateService();
   const { tenant } = useAuth();
   const currency = tenant?.currency || 'KWD';
 
   const form = useForm<FormData>({
     resolver: zodResolver(formSchema),
     defaultValues: {
      name: '',
      name_ar: '',
      category: 'other',
      gl_category: 'other',
      price: 0,
      duration: 30,
      color: '#6366f1',
      deposit_required: false,
      deposit_amount: 0,
      is_active: true,
    },
  });
 
   const watchDepositRequired = form.watch('deposit_required');
 
   useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        name_ar: service.name_ar || '',
        category: service.category as ServiceCategory,
        gl_category: (service as any).gl_category || 'other',
        price: Number(service.price),
        duration: service.duration,
        color: service.color || '#6366f1',
        deposit_required: service.deposit_required,
        deposit_amount: Number(service.deposit_amount) || 0,
        is_active: service.is_active,
      });
    }
   }, [service, form]);
 
   const onSubmit = async (data: FormData) => {
     if (!serviceId) return;
     await updateService.mutateAsync({
       id: serviceId,
       ...data,
       deposit_amount: data.deposit_required ? data.deposit_amount : 0,
     });
     setIsEditing(false);
   };
 
   const handleClose = () => {
     setIsEditing(false);
     onOpenChange(false);
   };
 
   const getCategoryLabel = (cat: string) => {
     return SERVICE_CATEGORIES.find(c => c.value === cat)?.label || cat;
   };
 
   if (!serviceId) return null;
 
   return (
     <Sheet open={open} onOpenChange={handleClose}>
       <SheetContent className="w-full sm:max-w-lg">
         <SheetHeader>
           <SheetTitle>Service Details</SheetTitle>
         </SheetHeader>
 
         {isLoading ? (
           <div className="space-y-4 mt-6">
             <Skeleton className="h-20 w-full" />
             <Skeleton className="h-40 w-full" />
           </div>
         ) : service ? (
           <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
             {!isEditing ? (
               <div className="space-y-6 mt-6">
                 {/* Service Header */}
                 <div className="flex items-start gap-4">
                   <div
                     className="h-14 w-14 rounded-lg flex items-center justify-center text-white text-xl font-semibold"
                     style={{ backgroundColor: service.color || '#6366f1' }}
                   >
                     {service.name.charAt(0).toUpperCase()}
                   </div>
                   <div className="flex-1">
                     <h3 className="text-lg font-semibold">{service.name}</h3>
                     {service.name_ar && (
                       <p className="text-muted-foreground" dir="rtl">{service.name_ar}</p>
                     )}
                     <div className="flex items-center gap-2 mt-1">
                       <Badge variant={service.is_active ? 'default' : 'secondary'}>
                         {service.is_active ? 'Active' : 'Inactive'}
                       </Badge>
                       <Badge variant="outline">{getCategoryLabel(service.category)}</Badge>
                     </div>
                   </div>
                 </div>
 
                 {/* Pricing & Duration */}
                 <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 rounded-lg bg-muted/50">
                     <div className="flex items-center gap-2 text-sm font-medium mb-1">
                       <DollarSign className="h-4 w-4" />
                       Price
                     </div>
                     <p className="text-2xl font-bold">{Number(service.price).toFixed(2)} KWD</p>
                   </div>
                   <div className="p-4 rounded-lg bg-muted/50">
                     <div className="flex items-center gap-2 text-sm font-medium mb-1">
                       <Clock className="h-4 w-4" />
                       Duration
                     </div>
                     <p className="text-2xl font-bold">{service.duration} min</p>
                   </div>
                 </div>
 
                 {/* Details */}
                 <div className="space-y-3">
                   <h4 className="text-sm font-medium text-muted-foreground">Details</h4>
                   <div className="space-y-2">
                     <div className="flex items-center gap-2 text-sm">
                       <Tag className="h-4 w-4 text-muted-foreground" />
                       Category: {getCategoryLabel(service.category)}
                     </div>
                     <div className="flex items-center gap-2 text-sm">
                       <Palette className="h-4 w-4 text-muted-foreground" />
                       <span
                         className="w-4 h-4 rounded"
                         style={{ backgroundColor: service.color || '#6366f1' }}
                       />
                       {service.color}
                     </div>
                   </div>
                 </div>
 
                 {/* Deposit Info */}
                 <div className="space-y-3">
                   <h4 className="text-sm font-medium text-muted-foreground">Online Booking</h4>
                   <div className="p-4 rounded-lg border">
                     <div className="flex items-center gap-2">
                       <CreditCard className="h-4 w-4" />
                       <span className="font-medium">Deposit Required</span>
                       <Badge variant={service.deposit_required ? 'default' : 'secondary'} className="ml-auto">
                         {service.deposit_required ? 'Yes' : 'No'}
                       </Badge>
                     </div>
                     {service.deposit_required && (
                       <p className="mt-2 text-sm text-muted-foreground">
                         Amount: {Number(service.deposit_amount).toFixed(2)} KWD
                       </p>
                     )}
                   </div>
                 </div>
 
                  {/* Service Recipe (BOM) */}
                   <ServiceRecipeEditor serviceId={serviceId} />

                   {/* Price Schedules */}
                   <div className="space-y-2">
                     <h4 className="text-sm font-medium text-muted-foreground">Price Schedules</h4>
                     <ServicePriceSchedules
                       serviceId={serviceId}
                       basePrice={Number(service.price)}
                       currency={currency}
                     />
                   </div>

                   {/* Usage History */}
                   <div className="space-y-2">
                     <h4 className="text-sm font-medium text-muted-foreground">Usage History</h4>
                     <ServiceUsageHistory serviceId={serviceId} />
                   </div>

                   <Button onClick={() => setIsEditing(true)} className="w-full">
                     Edit Service
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
                       name="category"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Category</FormLabel>
                           <Select onValueChange={field.onChange} value={field.value}>
                             <FormControl>
                               <SelectTrigger>
                                 <SelectValue />
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

                  <FormField
                    control={form.control}
                    name="gl_category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GL Revenue Category / تصنيف الإيراد المحاسبي</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GL_CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label_en} · {c.label_ar}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Routes revenue to the matching GL account when posted.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

 
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
                     name="is_active"
                     render={({ field }) => (
                       <FormItem className="flex items-center justify-between rounded-lg border p-3">
                         <div>
                           <FormLabel className="text-base">Active Status</FormLabel>
                           <FormDescription>
                             Inactive services won't appear in booking
                           </FormDescription>
                         </div>
                         <FormControl>
                           <Switch checked={field.value} onCheckedChange={field.onChange} />
                         </FormControl>
                       </FormItem>
                     )}
                   />
 
                   <FormField
                     control={form.control}
                     name="deposit_required"
                     render={({ field }) => (
                       <FormItem className="flex items-center justify-between rounded-lg border p-3">
                         <div>
                           <FormLabel className="text-base">Require Deposit</FormLabel>
                           <FormDescription>
                             Collect deposit for online bookings
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
 
                   <div className="flex gap-2 pt-4">
                     <Button
                       type="button"
                       variant="outline"
                       onClick={() => setIsEditing(false)}
                       className="flex-1"
                     >
                       Cancel
                     </Button>
                     <Button type="submit" disabled={updateService.isPending} className="flex-1">
                       {updateService.isPending ? 'Saving...' : 'Save Changes'}
                     </Button>
                   </div>
                 </form>
               </Form>
             )}
           </ScrollArea>
         ) : (
           <div className="mt-6 text-center text-muted-foreground">
             Service not found
           </div>
         )}
       </SheetContent>
     </Sheet>
   );
 };
 
 export default ServiceDetailSheet;