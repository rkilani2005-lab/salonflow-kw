 import { useState } from 'react';
 import { useForm } from 'react-hook-form';
 import { zodResolver } from '@hookform/resolvers/zod';
 import { z } from 'zod';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { useCreateClient, ClientTier, SimilarClient } from '@/hooks/useClients';
 import { formatPhoneInput } from '@/lib/phoneUtils';
 import SimilarClientSuggestions from './SimilarClientSuggestions';

 const clientSchema = z.object({
   name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
   phone: z.string().trim().min(1, 'Phone is required').max(20, 'Phone must be less than 20 characters'),
   email: z.string().trim().email('Invalid email').max(255).optional().or(z.literal('')),
   notes: z.string().trim().max(500, 'Notes must be less than 500 characters').optional(),
   tier: z.enum(['normal', 'vip', 'vvip']).default('normal'),
 });
 
 type ClientFormData = z.infer<typeof clientSchema>;
 
 interface AddClientDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   /** Called when the user picks an existing client from the suggestion list
    *  instead of creating a new row.  Use this to open the client detail
    *  sheet for that client.  If omitted, the dialog will simply close. */
   onPickExisting?: (clientId: string) => void;
 }
 
 const AddClientDialog = ({ open, onOpenChange, onPickExisting }: AddClientDialogProps) => {
   const createClient = useCreateClient();
   const [tier, setTier] = useState<ClientTier>('normal');
 
   const {
     register,
     handleSubmit,
     reset,
     setValue,
     watch,
     formState: { errors, isSubmitting },
   } = useForm<ClientFormData>({
     resolver: zodResolver(clientSchema),
     defaultValues: { tier: 'normal' },
   });
 
   const watchedName  = watch('name');
   const watchedPhone = watch('phone');
   const watchedEmail = watch('email');
 
   const handlePickExisting = (c: SimilarClient) => {
     onPickExisting?.(c.id);
     reset();
     setTier('normal');
     onOpenChange(false);
   };
 
   const onSubmit = async (data: ClientFormData) => {
     await createClient.mutateAsync({
      name: data.name,
      phone: data.phone,
       tier,
       email: data.email || undefined,
      notes: data.notes || undefined,
     });
     reset();
     setTier('normal');
     onOpenChange(false);
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-[425px]">
         <DialogHeader>
           <DialogTitle>Add New Client</DialogTitle>
           <DialogDescription>
             Create a new client profile for your salon.
           </DialogDescription>
         </DialogHeader>
         
         <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="name">Name *</Label>
             <Input
               id="name"
               placeholder="Client name"
               {...register('name')}
             />
             {errors.name && (
               <p className="text-sm text-destructive">{errors.name.message}</p>
             )}
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="phone">Phone *</Label>
             <Input
               id="phone"
               type="tel"
               inputMode="numeric"
               dir="ltr"
               placeholder="+965 9XXX XXXX"
               className="font-mono"
               {...register('phone')}
               onFocus={e => { if (!e.target.value) setValue('phone', '+965 '); }}
               onChange={e => setValue('phone', formatPhoneInput(e.target.value), { shouldValidate: true })}
             />
             {errors.phone && (
               <p className="text-sm text-destructive">{errors.phone.message}</p>
             )}
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="email">Email</Label>
             <Input
               id="email"
               type="email"
               placeholder="client@example.com"
               {...register('email')}
             />
             {errors.email && (
               <p className="text-sm text-destructive">{errors.email.message}</p>
             )}
           </div>

           {/* Live duplicate suggestions — phone/email = hard conflict, name = soft */}
           <SimilarClientSuggestions
             name={watchedName}
             phone={watchedPhone}
             email={watchedEmail}
             onPickExisting={handlePickExisting}
           />
 
           <div className="space-y-2">
             <Label htmlFor="tier">Client Tier</Label>
             <Select value={tier} onValueChange={(v) => setTier(v as ClientTier)}>
               <SelectTrigger>
                 <SelectValue placeholder="Select tier" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="normal">Normal</SelectItem>
                 <SelectItem value="vip">VIP</SelectItem>
                 <SelectItem value="vvip">VVIP</SelectItem>
               </SelectContent>
             </Select>
           </div>
 
           <div className="space-y-2">
             <Label htmlFor="notes">Notes</Label>
             <Textarea
               id="notes"
               placeholder="Any special notes about this client..."
               {...register('notes')}
             />
             {errors.notes && (
               <p className="text-sm text-destructive">{errors.notes.message}</p>
             )}
           </div>
 
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button type="submit" disabled={isSubmitting || createClient.isPending}>
               {createClient.isPending ? 'Creating...' : 'Add Client'}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default AddClientDialog;