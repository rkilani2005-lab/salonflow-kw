 import { useState, useMemo } from 'react';
 import { format } from 'date-fns';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Card, CardContent } from '@/components/ui/card';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Search, Plus, Users, Star, Filter } from 'lucide-react';
 import { useClients, ClientTier } from '@/hooks/useClients';
 import AddClientDialog from '@/components/clients/AddClientDialog';
 import ClientDetailSheet from '@/components/clients/ClientDetailSheet';
 import { cn } from '@/lib/utils';
 import { useDebounce } from '@/hooks/useDebounce';
 
 const tierColors: Record<ClientTier, string> = {
   normal: 'bg-muted text-muted-foreground',
   vip: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
   vvip: 'bg-primary/10 text-primary',
 };
 
 const Clients = () => {
   const [searchInput, setSearchInput] = useState('');
   const [tierFilter, setTierFilter] = useState<string>('all');
   const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
   const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
   const [isDetailOpen, setIsDetailOpen] = useState(false);
 
   const debouncedSearch = useDebounce(searchInput, 300);
   const { data: clients, isLoading } = useClients(debouncedSearch);
 
   const filteredClients = useMemo(() => {
     if (!clients) return [];
     if (tierFilter === 'all') return clients;
     return clients.filter(c => c.tier === tierFilter);
   }, [clients, tierFilter]);
 
   const stats = useMemo(() => {
     if (!clients) return { total: 0, vip: 0, vvip: 0 };
     return {
       total: clients.length,
       vip: clients.filter(c => c.tier === 'vip').length,
       vvip: clients.filter(c => c.tier === 'vvip').length,
     };
   }, [clients]);
 
   const handleRowClick = (clientId: string) => {
     setSelectedClientId(clientId);
     setIsDetailOpen(true);
   };
 
   return (
     <div className="p-6 space-y-6">
       {/* Header */}
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
         <div>
           <h1 className="text-2xl font-bold">Clients</h1>
           <p className="text-muted-foreground">Manage your salon's client database</p>
         </div>
         <Button onClick={() => setIsAddDialogOpen(true)}>
           <Plus className="h-4 w-4 mr-2" />
           Add Client
         </Button>
       </div>
 
       {/* Stats Cards */}
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
               <Users className="h-5 w-5" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.total}</p>
               <p className="text-sm text-muted-foreground">Total Clients</p>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
              <Star className="h-5 w-5 text-secondary-foreground" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.vip}</p>
               <p className="text-sm text-muted-foreground">VIP Clients</p>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
               <Star className="h-5 w-5 text-primary" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.vvip}</p>
               <p className="text-sm text-muted-foreground">VVIP Clients</p>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Search and Filters */}
       <div className="flex flex-col sm:flex-row gap-4">
         <div className="relative flex-1">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Search by name, phone, or email..."
             value={searchInput}
             onChange={(e) => setSearchInput(e.target.value)}
             className="pl-10"
           />
         </div>
         <Select value={tierFilter} onValueChange={setTierFilter}>
           <SelectTrigger className="w-full sm:w-[180px]">
             <Filter className="h-4 w-4 mr-2" />
             <SelectValue placeholder="Filter by tier" />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="all">All Tiers</SelectItem>
             <SelectItem value="normal">Normal</SelectItem>
             <SelectItem value="vip">VIP</SelectItem>
             <SelectItem value="vvip">VVIP</SelectItem>
           </SelectContent>
         </Select>
       </div>
 
       {/* Clients Table */}
       <Card>
         <CardContent className="p-0">
           {isLoading ? (
             <div className="p-4 space-y-3">
               {[...Array(5)].map((_, i) => (
                 <Skeleton key={i} className="h-12 w-full" />
               ))}
             </div>
           ) : filteredClients.length === 0 ? (
             <div className="text-center py-12">
               <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
               <h3 className="font-medium mb-1">No clients found</h3>
               <p className="text-sm text-muted-foreground mb-4">
                 {searchInput || tierFilter !== 'all' 
                   ? 'Try adjusting your search or filters'
                   : 'Add your first client to get started'}
               </p>
               {!searchInput && tierFilter === 'all' && (
                 <Button onClick={() => setIsAddDialogOpen(true)}>
                   <Plus className="h-4 w-4 mr-2" />
                   Add Client
                 </Button>
               )}
             </div>
           ) : (
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Name</TableHead>
                   <TableHead>Phone</TableHead>
                   <TableHead className="hidden md:table-cell">Email</TableHead>
                   <TableHead>Tier</TableHead>
                   <TableHead className="hidden sm:table-cell">Created</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredClients.map((client) => (
                   <TableRow
                     key={client.id}
                     className="cursor-pointer hover:bg-muted/50"
                     onClick={() => handleRowClick(client.id)}
                   >
                     <TableCell className="font-medium">{client.name}</TableCell>
                     <TableCell>{client.phone}</TableCell>
                     <TableCell className="hidden md:table-cell text-muted-foreground">
                       {client.email || '-'}
                     </TableCell>
                     <TableCell>
                       <Badge className={cn('uppercase text-xs', tierColors[client.tier as ClientTier])}>
                         {client.tier}
                       </Badge>
                     </TableCell>
                     <TableCell className="hidden sm:table-cell text-muted-foreground">
                       {format(new Date(client.created_at), 'MMM d, yyyy')}
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           )}
         </CardContent>
       </Card>
 
       {/* Dialogs */}
       <AddClientDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
       <ClientDetailSheet
         clientId={selectedClientId}
         open={isDetailOpen}
         onOpenChange={setIsDetailOpen}
       />
     </div>
   );
 };
 
 export default Clients;