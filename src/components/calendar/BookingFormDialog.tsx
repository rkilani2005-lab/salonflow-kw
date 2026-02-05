 import { useState } from 'react';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { Textarea } from '@/components/ui/textarea';
 import { Staff, Service, Client } from '@/types/calendar';
 
 interface BookingFormDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   staff: Staff[];
   services: Service[];
   clients: Client[];
   preselectedStaffId?: string;
   preselectedTime?: string;
   preselectedDate?: string;
   onSubmit: (booking: {
     clientId: string;
     staffId: string;
     serviceId: string;
     date: string;
     time: string;
     notes: string;
   }) => void;
 }
 
 export function BookingFormDialog({
   open,
   onOpenChange,
   staff,
   services,
   clients,
   preselectedStaffId,
   preselectedTime,
   preselectedDate,
   onSubmit,
 }: BookingFormDialogProps) {
   const [clientId, setClientId] = useState('');
   const [staffId, setStaffId] = useState(preselectedStaffId || '');
   const [serviceId, setServiceId] = useState('');
   const [date, setDate] = useState(preselectedDate || new Date().toISOString().split('T')[0]);
   const [time, setTime] = useState(preselectedTime || '09:00');
   const [notes, setNotes] = useState('');
 
   const selectedService = services.find(s => s.id === serviceId);
 
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!clientId || !staffId || !serviceId) return;
     
     onSubmit({ clientId, staffId, serviceId, date, time, notes });
     
     // Reset form
     setClientId('');
     setServiceId('');
     setNotes('');
     onOpenChange(false);
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-[500px]">
         <DialogHeader>
           <DialogTitle>New Booking</DialogTitle>
         </DialogHeader>
         
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="grid gap-4">
             <div className="space-y-2">
               <Label htmlFor="client">Client</Label>
               <Select value={clientId} onValueChange={setClientId}>
                 <SelectTrigger>
                   <SelectValue placeholder="Select client..." />
                 </SelectTrigger>
                 <SelectContent>
                   {clients.map((client) => (
                     <SelectItem key={client.id} value={client.id}>
                       {client.name} {client.tier === 'vip' && '⭐'}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="service">Service</Label>
               <Select value={serviceId} onValueChange={setServiceId}>
                 <SelectTrigger>
                   <SelectValue placeholder="Select service..." />
                 </SelectTrigger>
                 <SelectContent>
                   {services.map((service) => (
                     <SelectItem key={service.id} value={service.id}>
                       {service.name} ({service.duration} min) - {service.price.toFixed(3)} KWD
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="staff">Staff</Label>
               <Select value={staffId} onValueChange={setStaffId}>
                 <SelectTrigger>
                   <SelectValue placeholder="Select staff..." />
                 </SelectTrigger>
                 <SelectContent>
                   {staff.map((member) => (
                     <SelectItem key={member.id} value={member.id}>
                       {member.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="date">Date</Label>
                 <Input
                   id="date"
                   type="date"
                   value={date}
                   onChange={(e) => setDate(e.target.value)}
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="time">Time</Label>
                 <Input
                   id="time"
                   type="time"
                   step="900"
                   value={time}
                   onChange={(e) => setTime(e.target.value)}
                 />
               </div>
             </div>
 
             {selectedService && (
               <div className="p-3 bg-muted rounded-lg text-sm">
                 <p><strong>Duration:</strong> {selectedService.duration} minutes</p>
                 <p><strong>Price:</strong> {selectedService.price.toFixed(3)} KWD</p>
               </div>
             )}
 
             <div className="space-y-2">
               <Label htmlFor="notes">Notes</Label>
               <Textarea
                 id="notes"
                 placeholder="Any special requests or notes..."
                 value={notes}
                 onChange={(e) => setNotes(e.target.value)}
               />
             </div>
           </div>
 
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button type="submit" disabled={!clientId || !staffId || !serviceId}>
               Create Booking
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 }