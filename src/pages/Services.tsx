 import { useState, useMemo } from 'react';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Search, Plus, Scissors, Clock, DollarSign, Filter } from 'lucide-react';
 import { useServicesManagement, SERVICE_CATEGORIES, Service } from '@/hooks/useServices';
 import AddServiceDialog from '@/components/services/AddServiceDialog';
 import ServiceDetailSheet from '@/components/services/ServiceDetailSheet';
 import { useDebounce } from '@/hooks/useDebounce';
 
 const Services = () => {
   const [searchInput, setSearchInput] = useState('');
   const [categoryFilter, setCategoryFilter] = useState<string>('all');
   const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
   const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
   const [isDetailOpen, setIsDetailOpen] = useState(false);
 
   const debouncedSearch = useDebounce(searchInput, 300);
   const { data: services, isLoading } = useServicesManagement(debouncedSearch, categoryFilter);
 
   const stats = useMemo(() => {
     if (!services) return { total: 0, active: 0, categories: 0 };
     const uniqueCategories = new Set(services.map(s => s.category));
     return {
       total: services.length,
       active: services.filter(s => s.is_active).length,
       categories: uniqueCategories.size,
     };
   }, [services]);
 
   // Group services by category
   const groupedServices = useMemo(() => {
     if (!services) return {};
     return services.reduce((acc, service) => {
       const cat = service.category;
       if (!acc[cat]) acc[cat] = [];
       acc[cat].push(service);
       return acc;
     }, {} as Record<string, Service[]>);
   }, [services]);
 
   const getCategoryLabel = (cat: string) => {
     return SERVICE_CATEGORIES.find(c => c.value === cat)?.label || cat;
   };
 
   const handleCardClick = (serviceId: string) => {
     setSelectedServiceId(serviceId);
     setIsDetailOpen(true);
   };
 
   return (
     <div className="p-6 space-y-6">
       {/* Header */}
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
         <div>
           <h1 className="text-2xl font-bold">Services</h1>
           <p className="text-muted-foreground">Manage your service catalog and pricing</p>
         </div>
         <Button onClick={() => setIsAddDialogOpen(true)}>
           <Plus className="h-4 w-4 mr-2" />
           Add Service
         </Button>
       </div>
 
       {/* Stats Cards */}
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
               <Scissors className="h-5 w-5" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.total}</p>
               <p className="text-sm text-muted-foreground">Total Services</p>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
               <Scissors className="h-5 w-5 text-primary" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.active}</p>
               <p className="text-sm text-muted-foreground">Active Services</p>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
               <Filter className="h-5 w-5 text-secondary-foreground" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.categories}</p>
               <p className="text-sm text-muted-foreground">Categories</p>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Search and Filters */}
       <div className="flex flex-col sm:flex-row gap-4">
         <div className="relative flex-1">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Search services..."
             value={searchInput}
             onChange={(e) => setSearchInput(e.target.value)}
             className="pl-10"
           />
         </div>
         <Select value={categoryFilter} onValueChange={setCategoryFilter}>
           <SelectTrigger className="w-full sm:w-[180px]">
             <Filter className="h-4 w-4 mr-2" />
             <SelectValue placeholder="All Categories" />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="all">All Categories</SelectItem>
             {SERVICE_CATEGORIES.map((cat) => (
               <SelectItem key={cat.value} value={cat.value}>
                 {cat.label}
               </SelectItem>
             ))}
           </SelectContent>
         </Select>
       </div>
 
       {/* Services List */}
       {isLoading ? (
         <div className="space-y-4">
           {[...Array(3)].map((_, i) => (
             <Skeleton key={i} className="h-40 w-full" />
           ))}
         </div>
       ) : services?.length === 0 ? (
         <Card>
           <CardContent className="text-center py-12">
             <Scissors className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
             <h3 className="font-medium mb-1">No services found</h3>
             <p className="text-sm text-muted-foreground mb-4">
               {searchInput || categoryFilter !== 'all'
                 ? 'Try adjusting your search or filters'
                 : 'Add your first service to get started'}
             </p>
             {!searchInput && categoryFilter === 'all' && (
               <Button onClick={() => setIsAddDialogOpen(true)}>
                 <Plus className="h-4 w-4 mr-2" />
                 Add Service
               </Button>
             )}
           </CardContent>
         </Card>
       ) : categoryFilter === 'all' ? (
         // Grouped view by category
         <div className="space-y-6">
           {Object.entries(groupedServices).map(([category, categoryServices]) => (
             <Card key={category}>
               <CardHeader className="pb-3">
                 <CardTitle className="text-lg flex items-center gap-2">
                   {getCategoryLabel(category)}
                   <Badge variant="secondary" className="ml-2">
                     {categoryServices.length}
                   </Badge>
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                   {categoryServices.map((service) => (
                     <div
                       key={service.id}
                       className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                       onClick={() => handleCardClick(service.id)}
                     >
                       <div
                         className="h-10 w-10 rounded flex items-center justify-center text-white font-semibold shrink-0"
                         style={{ backgroundColor: service.color || '#6366f1' }}
                       >
                         {service.name.charAt(0).toUpperCase()}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="font-medium truncate">{service.name}</span>
                           {!service.is_active && (
                             <Badge variant="secondary" className="text-xs">Inactive</Badge>
                           )}
                         </div>
                         <div className="flex items-center gap-3 text-xs text-muted-foreground">
                           <span className="flex items-center gap-1">
                             <DollarSign className="h-3 w-3" />
                             {Number(service.price).toFixed(2)} KWD
                           </span>
                           <span className="flex items-center gap-1">
                             <Clock className="h-3 w-3" />
                             {service.duration} min
                           </span>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>
       ) : (
         // Flat list for filtered view
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {services?.map((service) => (
             <Card
               key={service.id}
               className="cursor-pointer hover:shadow-md transition-shadow"
               onClick={() => handleCardClick(service.id)}
             >
               <CardContent className="p-4">
                 <div className="flex items-start gap-3">
                   <div
                     className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-semibold"
                     style={{ backgroundColor: service.color || '#6366f1' }}
                   >
                     {service.name.charAt(0).toUpperCase()}
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center justify-between gap-2">
                       <h3 className="font-semibold truncate">{service.name}</h3>
                       <Badge variant={service.is_active ? 'default' : 'secondary'}>
                         {service.is_active ? 'Active' : 'Inactive'}
                       </Badge>
                     </div>
                     {service.name_ar && (
                       <p className="text-sm text-muted-foreground truncate" dir="rtl">
                         {service.name_ar}
                       </p>
                     )}
                   </div>
                 </div>
                 <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                   <span className="flex items-center gap-1 text-muted-foreground">
                     <DollarSign className="h-4 w-4" />
                     {Number(service.price).toFixed(2)} KWD
                   </span>
                   <span className="flex items-center gap-1 text-muted-foreground">
                     <Clock className="h-4 w-4" />
                     {service.duration} min
                   </span>
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>
       )}
 
       {/* Dialogs */}
       <AddServiceDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
       <ServiceDetailSheet
         serviceId={selectedServiceId}
         open={isDetailOpen}
         onOpenChange={setIsDetailOpen}
       />
     </div>
   );
 };
 
 export default Services;