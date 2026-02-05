 import { useState, useEffect } from 'react';
 import { useSearchParams } from 'react-router-dom';
 import { supabase } from '@/integrations/supabase/client';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Calendar } from '@/components/ui/calendar';
 import { Badge } from '@/components/ui/badge';
 import { useToast } from '@/hooks/use-toast';
 import { Loader2, Clock, User, CreditCard, CheckCircle2 } from 'lucide-react';
 import { format } from 'date-fns';
 
 interface Service {
   id: string;
   name: string;
   name_ar: string | null;
   category: string;
   duration: number;
   price: number;
   deposit_required: boolean;
   deposit_amount: number;
   color: string;
 }
 
 interface Staff {
   id: string;
   name: string;
   name_ar: string | null;
   color: string;
   working_hours_start: string;
   working_hours_end: string;
 }
 
 type BookingStep = 'service' | 'datetime' | 'details' | 'payment' | 'success';
 
 export default function BookingPage() {
   const [searchParams] = useSearchParams();
   const { toast } = useToast();
   
   const [step, setStep] = useState<BookingStep>('service');
   const [services, setServices] = useState<Service[]>([]);
   const [staff, setStaff] = useState<Staff[]>([]);
   const [loading, setLoading] = useState(true);
   const [submitting, setSubmitting] = useState(false);
 
   // Form state
   const [selectedService, setSelectedService] = useState<Service | null>(null);
   const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
   const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
   const [selectedTime, setSelectedTime] = useState<string>('');
   const [clientName, setClientName] = useState('');
   const [clientPhone, setClientPhone] = useState('');
   const [clientEmail, setClientEmail] = useState('');
 
   useEffect(() => {
     loadData();
   }, []);
 
   // Check for success/error from payment callback
   useEffect(() => {
     const bookingId = searchParams.get('booking');
     if (bookingId && window.location.pathname.includes('success')) {
       setStep('success');
       checkPaymentStatus(bookingId);
     }
   }, [searchParams]);
 
   const loadData = async () => {
     try {
       const [servicesRes, staffRes] = await Promise.all([
         supabase.from('services').select('*').eq('is_active', true),
         supabase.from('staff').select('*').eq('is_active', true),
       ]);
 
       if (servicesRes.data) setServices(servicesRes.data);
       if (staffRes.data) setStaff(staffRes.data);
     } catch (error) {
       console.error('Error loading data:', error);
     } finally {
       setLoading(false);
     }
   };
 
   const checkPaymentStatus = async (bookingId: string) => {
     try {
       const { data: booking } = await supabase
         .from('bookings')
         .select('*')
         .eq('id', bookingId)
         .single();
 
       if (booking?.payment_id) {
         const response = await supabase.functions.invoke('myfatoorah-payment', {
           body: { action: 'status', paymentId: booking.payment_id },
         });
         
         if (response.data?.isPaid) {
           toast({ title: 'Payment Confirmed!', description: 'Your deposit has been received.' });
         }
       }
     } catch (error) {
       console.error('Error checking payment:', error);
     }
   };
 
   const generateTimeSlots = () => {
     const slots: string[] = [];
     const startHour = selectedStaff 
       ? parseInt(selectedStaff.working_hours_start.split(':')[0]) 
       : 9;
     const endHour = selectedStaff 
       ? parseInt(selectedStaff.working_hours_end.split(':')[0]) 
       : 18;
 
     for (let h = startHour; h < endHour; h++) {
       slots.push(`${h.toString().padStart(2, '0')}:00`);
       slots.push(`${h.toString().padStart(2, '0')}:30`);
     }
     return slots;
   };
 
   const handleSubmit = async () => {
     if (!selectedService || !selectedDate || !selectedTime || !clientName || !clientPhone) {
       toast({ title: 'Missing Information', description: 'Please fill in all required fields.', variant: 'destructive' });
       return;
     }
 
     setSubmitting(true);
     try {
       // Calculate end time
       const [h, m] = selectedTime.split(':').map(Number);
       const endMinutes = h * 60 + m + selectedService.duration;
       const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
 
       // Create or find client
       let clientId: string | undefined;
       const { data: existingClient } = await supabase
         .from('clients')
         .select('id')
         .eq('phone', clientPhone)
         .maybeSingle();
 
       if (existingClient) {
         clientId = existingClient.id;
       } else {
         const { data: newClient } = await supabase
           .from('clients')
           .insert({ name: clientName, phone: clientPhone, email: clientEmail || null })
           .select('id')
           .single();
         clientId = newClient?.id;
       }
 
       // Create booking
      const bookingData = {
        client_id: clientId,
        client_name: clientName,
        client_phone: clientPhone,
        staff_id: selectedStaff?.id || null,
        service_id: selectedService.id,
        service_name: selectedService.name,
        service_category: selectedService.category as 'hair' | 'nails' | 'facial' | 'makeup' | 'waxing' | 'massage' | 'other',
        booking_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: selectedTime,
        end_time: endTime,
        duration: selectedService.duration,
        price: selectedService.price,
        deposit_amount: selectedService.deposit_amount,
        is_online_booking: true,
        status: (selectedService.deposit_required ? 'planned' : 'confirmed') as 'planned' | 'confirmed',
      };
      
      const { data: booking, error: bookingError } = await supabase
         .from('bookings')
        .insert(bookingData)
         .select()
         .single();
 
       if (bookingError) throw bookingError;
 
       // If deposit required, create payment
       if (selectedService.deposit_required && selectedService.deposit_amount > 0) {
         const paymentResponse = await supabase.functions.invoke('myfatoorah-payment', {
           body: {
             action: 'create',
             bookingId: booking.id,
             amount: selectedService.deposit_amount,
             clientName,
             clientPhone,
             clientEmail,
             serviceName: `Deposit: ${selectedService.name}`,
           },
         });
 
         if (paymentResponse.data?.paymentUrl) {
           // Redirect to payment
           window.location.href = paymentResponse.data.paymentUrl;
           return;
         } else {
           throw new Error(paymentResponse.data?.error || 'Failed to create payment');
         }
       } else {
         // No deposit required - booking confirmed
         setStep('success');
         toast({ title: 'Booking Confirmed!', description: 'Your appointment has been scheduled.' });
       }
     } catch (error) {
       console.error('Booking error:', error);
       toast({ title: 'Booking Failed', description: 'Please try again.', variant: 'destructive' });
     } finally {
       setSubmitting(false);
     }
   };
 
   if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (step === 'success') {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background p-4">
         <Card className="max-w-md w-full text-center">
           <CardHeader>
             <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
             <CardTitle className="text-2xl">Booking Confirmed!</CardTitle>
             <CardDescription>
               Your appointment has been scheduled. You will receive a confirmation shortly.
             </CardDescription>
           </CardHeader>
           <CardContent>
             <Button onClick={() => window.location.href = '/book'} className="w-full">
               Book Another Appointment
             </Button>
           </CardContent>
         </Card>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen bg-background">
       {/* Header */}
       <header className="border-b bg-card py-4 px-6">
         <h1 className="text-2xl font-bold">Book Your Appointment</h1>
         <p className="text-muted-foreground">Select a service and choose your preferred time</p>
       </header>
 
       <div className="container max-w-4xl mx-auto py-8 px-4">
         {/* Progress Steps */}
         <div className="flex items-center justify-center gap-2 mb-8">
           {(['service', 'datetime', 'details'] as const).map((s, i) => (
             <div key={s} className="flex items-center">
               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                 ${step === s ? 'bg-primary text-primary-foreground' : 
                   i < ['service', 'datetime', 'details'].indexOf(step) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                 {i + 1}
               </div>
               {i < 2 && <div className="w-16 h-0.5 bg-muted mx-2" />}
             </div>
           ))}
         </div>
 
         {/* Step 1: Select Service */}
         {step === 'service' && (
           <div className="space-y-6">
             <h2 className="text-xl font-semibold">Choose a Service</h2>
             <div className="grid gap-4 md:grid-cols-2">
               {services.map((service) => (
                 <Card 
                   key={service.id}
                   className={`cursor-pointer transition-all hover:shadow-md ${
                     selectedService?.id === service.id ? 'ring-2 ring-primary' : ''
                   }`}
                   onClick={() => setSelectedService(service)}
                 >
                   <CardHeader className="pb-2">
                     <div className="flex items-start justify-between">
                       <div>
                         <CardTitle className="text-lg">{service.name}</CardTitle>
                         {service.name_ar && (
                           <p className="text-sm text-muted-foreground">{service.name_ar}</p>
                         )}
                       </div>
                       <Badge variant="secondary" style={{ backgroundColor: service.color, color: 'white' }}>
                         {service.category}
                       </Badge>
                     </div>
                   </CardHeader>
                   <CardContent>
                     <div className="flex items-center justify-between text-sm">
                       <span className="flex items-center gap-1 text-muted-foreground">
                         <Clock className="h-4 w-4" /> {service.duration} min
                       </span>
                       <span className="font-semibold">{service.price.toFixed(3)} KWD</span>
                     </div>
                     {service.deposit_required && (
                       <div className="mt-2 flex items-center gap-1 text-sm text-orange-600">
                         <CreditCard className="h-4 w-4" />
                         Deposit required: {service.deposit_amount.toFixed(3)} KWD
                       </div>
                     )}
                   </CardContent>
                 </Card>
               ))}
             </div>
             <div className="flex justify-end">
               <Button 
                 onClick={() => setStep('datetime')} 
                 disabled={!selectedService}
               >
                 Continue
               </Button>
             </div>
           </div>
         )}
 
         {/* Step 2: Date & Time */}
         {step === 'datetime' && (
           <div className="space-y-6">
             <h2 className="text-xl font-semibold">Choose Date & Time</h2>
             
             {/* Staff Selection (Optional) */}
             <div className="space-y-2">
               <Label>Preferred Stylist (Optional)</Label>
               <Select value={selectedStaff?.id || ''} onValueChange={(id) => setSelectedStaff(staff.find(s => s.id === id) || null)}>
                 <SelectTrigger>
                   <SelectValue placeholder="Any available" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="">Any available</SelectItem>
                   {staff.map((member) => (
                     <SelectItem key={member.id} value={member.id}>
                       {member.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="grid gap-6 md:grid-cols-2">
               {/* Calendar */}
               <div>
                 <Label className="mb-2 block">Select Date</Label>
                 <Calendar
                   mode="single"
                   selected={selectedDate}
                   onSelect={setSelectedDate}
                   disabled={(date) => date < new Date()}
                   className="rounded-md border"
                 />
               </div>
 
               {/* Time Slots */}
               <div>
                 <Label className="mb-2 block">Select Time</Label>
                 <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-auto">
                   {generateTimeSlots().map((time) => (
                     <Button
                       key={time}
                       variant={selectedTime === time ? 'default' : 'outline'}
                       size="sm"
                       onClick={() => setSelectedTime(time)}
                     >
                       {time}
                     </Button>
                   ))}
                 </div>
               </div>
             </div>
 
             <div className="flex justify-between">
               <Button variant="outline" onClick={() => setStep('service')}>Back</Button>
               <Button onClick={() => setStep('details')} disabled={!selectedDate || !selectedTime}>
                 Continue
               </Button>
             </div>
           </div>
         )}
 
         {/* Step 3: Client Details */}
         {step === 'details' && (
           <div className="space-y-6">
             <h2 className="text-xl font-semibold">Your Details</h2>
             
             {/* Summary */}
             {selectedService && selectedDate && (
               <Card className="bg-muted/50">
                 <CardContent className="pt-4">
                   <div className="grid gap-2 text-sm">
                     <div className="flex justify-between">
                       <span className="text-muted-foreground">Service:</span>
                       <span className="font-medium">{selectedService.name}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-muted-foreground">Date:</span>
                       <span className="font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-muted-foreground">Time:</span>
                       <span className="font-medium">{selectedTime}</span>
                     </div>
                     {selectedStaff && (
                       <div className="flex justify-between">
                         <span className="text-muted-foreground">Stylist:</span>
                         <span className="font-medium">{selectedStaff.name}</span>
                       </div>
                     )}
                     <hr className="my-2" />
                     <div className="flex justify-between">
                       <span className="text-muted-foreground">Total Price:</span>
                       <span className="font-medium">{selectedService.price.toFixed(3)} KWD</span>
                     </div>
                     {selectedService.deposit_required && (
                       <div className="flex justify-between text-orange-600">
                         <span>Deposit Required:</span>
                         <span className="font-medium">{selectedService.deposit_amount.toFixed(3)} KWD</span>
                       </div>
                     )}
                   </div>
                 </CardContent>
               </Card>
             )}
 
             <div className="space-y-4">
               <div className="space-y-2">
                 <Label htmlFor="name">Full Name *</Label>
                 <Input
                   id="name"
                   placeholder="Enter your name"
                   value={clientName}
                   onChange={(e) => setClientName(e.target.value)}
                   required
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="phone">Phone Number *</Label>
                 <Input
                   id="phone"
                   placeholder="+965 9XXX XXXX"
                   value={clientPhone}
                   onChange={(e) => setClientPhone(e.target.value)}
                   required
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="email">Email (Optional)</Label>
                 <Input
                   id="email"
                   type="email"
                   placeholder="your@email.com"
                   value={clientEmail}
                   onChange={(e) => setClientEmail(e.target.value)}
                 />
               </div>
             </div>
 
             <div className="flex justify-between">
               <Button variant="outline" onClick={() => setStep('datetime')}>Back</Button>
               <Button 
                 onClick={handleSubmit} 
                 disabled={submitting || !clientName || !clientPhone}
               >
                 {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 {selectedService?.deposit_required ? 'Pay Deposit & Book' : 'Confirm Booking'}
               </Button>
             </div>
           </div>
         )}
       </div>
     </div>
   );
 }