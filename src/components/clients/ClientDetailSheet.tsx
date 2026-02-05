 import { useState } from 'react';
 import { format } from 'date-fns';
 import {
   Sheet,
   SheetContent,
   SheetDescription,
   SheetHeader,
   SheetTitle,
 } from '@/components/ui/sheet';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
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
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Phone, Mail, Calendar, DollarSign, Star, Clock, Edit2, Save, X } from 'lucide-react';
 import { useClientWithStats, useUpdateClient, ClientTier } from '@/hooks/useClients';
 import { cn } from '@/lib/utils';
 
 interface ClientDetailSheetProps {
   clientId: string | null;
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const tierColors: Record<ClientTier, string> = {
   normal: 'bg-muted text-muted-foreground',
   vip: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
   vvip: 'bg-primary/10 text-primary',
 };
 
 const ClientDetailSheet = ({ clientId, open, onOpenChange }: ClientDetailSheetProps) => {
   const { data: client, isLoading } = useClientWithStats(clientId);
   const updateClient = useUpdateClient();
   const [isEditing, setIsEditing] = useState(false);
   const [editData, setEditData] = useState<{
     name: string;
     phone: string;
     email: string;
     notes: string;
     tier: ClientTier;
   } | null>(null);
 
   const startEditing = () => {
     if (client) {
       setEditData({
         name: client.name,
         phone: client.phone,
         email: client.email || '',
         notes: client.notes || '',
         tier: client.tier as ClientTier,
       });
       setIsEditing(true);
     }
   };
 
   const cancelEditing = () => {
     setIsEditing(false);
     setEditData(null);
   };
 
   const saveChanges = async () => {
     if (!client || !editData) return;
     await updateClient.mutateAsync({
       id: client.id,
       ...editData,
       email: editData.email || null,
       notes: editData.notes || null,
     });
     setIsEditing(false);
     setEditData(null);
   };
 
   if (isLoading || !client) {
     return (
       <Sheet open={open} onOpenChange={onOpenChange}>
         <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
           <SheetHeader>
             <Skeleton className="h-6 w-48" />
             <Skeleton className="h-4 w-32" />
           </SheetHeader>
           <div className="space-y-4 mt-6">
             <Skeleton className="h-24 w-full" />
             <Skeleton className="h-48 w-full" />
           </div>
         </SheetContent>
       </Sheet>
     );
   }
 
   return (
     <Sheet open={open} onOpenChange={onOpenChange}>
       <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
         <SheetHeader className="pb-4">
           <div className="flex items-start justify-between">
             <div>
               <SheetTitle className="text-xl">{client.name}</SheetTitle>
               <SheetDescription>
                 Client since {format(new Date(client.created_at), 'MMM yyyy')}
               </SheetDescription>
             </div>
             <Badge className={cn('uppercase', tierColors[client.tier as ClientTier])}>
               {client.tier}
             </Badge>
           </div>
         </SheetHeader>
 
         {/* Stats Cards */}
         <div className="grid grid-cols-3 gap-3 mb-6">
           <Card>
             <CardContent className="p-3 text-center">
               <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
               <p className="text-lg font-bold">{client.total_visits}</p>
               <p className="text-xs text-muted-foreground">Visits</p>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="p-3 text-center">
               <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
               <p className="text-lg font-bold">{client.total_spent}</p>
               <p className="text-xs text-muted-foreground">KWD Spent</p>
             </CardContent>
           </Card>
           <Card>
             <CardContent className="p-3 text-center">
               <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
               <p className="text-sm font-bold">
                 {client.last_visit ? format(new Date(client.last_visit), 'MMM d') : '-'}
               </p>
               <p className="text-xs text-muted-foreground">Last Visit</p>
             </CardContent>
           </Card>
         </div>
 
         <Tabs defaultValue="details" className="w-full">
           <TabsList className="w-full">
             <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
             <TabsTrigger value="history" className="flex-1">Visit History</TabsTrigger>
           </TabsList>
 
           <TabsContent value="details" className="space-y-4 mt-4">
             {/* Edit/Save buttons */}
             <div className="flex justify-end gap-2">
               {isEditing ? (
                 <>
                   <Button variant="outline" size="sm" onClick={cancelEditing}>
                     <X className="h-4 w-4 mr-1" /> Cancel
                   </Button>
                   <Button size="sm" onClick={saveChanges} disabled={updateClient.isPending}>
                     <Save className="h-4 w-4 mr-1" /> Save
                   </Button>
                 </>
               ) : (
                 <Button variant="outline" size="sm" onClick={startEditing}>
                   <Edit2 className="h-4 w-4 mr-1" /> Edit
                 </Button>
               )}
             </div>
 
             {isEditing && editData ? (
               <div className="space-y-4">
                 <div className="space-y-2">
                   <Label>Name</Label>
                   <Input
                     value={editData.name}
                     onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Phone</Label>
                   <Input
                     value={editData.phone}
                     onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Email</Label>
                   <Input
                     type="email"
                     value={editData.email}
                     onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Tier</Label>
                   <Select
                     value={editData.tier}
                     onValueChange={(v) => setEditData({ ...editData, tier: v as ClientTier })}
                   >
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="normal">Normal</SelectItem>
                       <SelectItem value="vip">VIP</SelectItem>
                       <SelectItem value="vvip">VVIP</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <Label>Notes</Label>
                   <Textarea
                     value={editData.notes}
                     onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                   />
                 </div>
               </div>
             ) : (
               <div className="space-y-4">
                 <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                   <Phone className="h-4 w-4 text-muted-foreground" />
                   <span>{client.phone}</span>
                 </div>
                 {client.email && (
                   <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                     <Mail className="h-4 w-4 text-muted-foreground" />
                     <span>{client.email}</span>
                   </div>
                 )}
                 {client.notes && (
                   <Card>
                     <CardHeader className="pb-2">
                       <CardTitle className="text-sm">Notes</CardTitle>
                     </CardHeader>
                     <CardContent>
                       <p className="text-sm text-muted-foreground">{client.notes}</p>
                     </CardContent>
                   </Card>
                 )}
               </div>
             )}
           </TabsContent>
 
           <TabsContent value="history" className="mt-4">
             {client.bookings && client.bookings.length > 0 ? (
               <div className="space-y-3">
                 {client.bookings.map((booking: any) => (
                   <Card key={booking.id}>
                     <CardContent className="p-4">
                       <div className="flex items-start justify-between">
                         <div>
                           <p className="font-medium">{booking.service_name}</p>
                           <p className="text-sm text-muted-foreground">
                             {format(new Date(booking.booking_date), 'MMM d, yyyy')} at {booking.start_time?.slice(0, 5)}
                           </p>
                         </div>
                         <div className="text-right">
                           <Badge variant={
                             booking.status === 'completed' ? 'default' :
                             booking.status === 'cancelled' ? 'destructive' : 'secondary'
                           }>
                             {booking.status}
                           </Badge>
                           <p className="text-sm font-medium mt-1">{booking.price} KWD</p>
                         </div>
                       </div>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             ) : (
               <div className="text-center py-8 text-muted-foreground">
                 <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                 <p>No visit history yet</p>
               </div>
             )}
           </TabsContent>
         </Tabs>
       </SheetContent>
     </Sheet>
   );
 };
 
 export default ClientDetailSheet;