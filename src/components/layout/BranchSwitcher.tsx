 import { useAuth } from '@/contexts/AuthContext';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { MapPin } from 'lucide-react';
 
 const BranchSwitcher = () => {
   const { branches, currentBranch, switchBranch } = useAuth();
 
   if (branches.length <= 1) {
     return (
       <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
         <MapPin className="h-4 w-4" />
         <span>{currentBranch?.name || 'No branch'}</span>
       </div>
     );
   }
 
   return (
     <Select value={currentBranch?.id} onValueChange={switchBranch}>
       <SelectTrigger className="w-full border-0 bg-transparent hover:bg-accent">
         <div className="flex items-center gap-2">
           <MapPin className="h-4 w-4 text-muted-foreground" />
           <SelectValue placeholder="Select branch" />
         </div>
       </SelectTrigger>
       <SelectContent>
         {branches.map((branch) => (
           <SelectItem key={branch.id} value={branch.id}>
             {branch.name}
           </SelectItem>
         ))}
       </SelectContent>
     </Select>
   );
 };
 
 export default BranchSwitcher;