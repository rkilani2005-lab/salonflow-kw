 import { useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 import { supabase } from '@/integrations/supabase/client';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { toast } from 'sonner';
 import { Building2, MapPin, User, Check, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
 import confetti from 'canvas-confetti';
 
 interface SalonDetails {
   name: string;
   logoUrl: string;
   defaultTaxRate: string;
 }
 
 interface BranchDetails {
   name: string;
   address: string;
   phone: string;
   openingTime: string;
   closingTime: string;
 }
 
 interface StaffDetails {
   name: string;
   phone: string;
   email: string;
 }
 
 const steps = [
   { id: 1, title: 'Salon Details', icon: Building2 },
   { id: 2, title: 'First Branch', icon: MapPin },
   { id: 3, title: 'First Staff', icon: User },
 ];
 
 const Onboarding = () => {
   const [currentStep, setCurrentStep] = useState(1);
   const [loading, setLoading] = useState(false);
   const { user, refreshProfile } = useAuth();
   const navigate = useNavigate();
 
   const [salon, setSalon] = useState<SalonDetails>({
     name: '',
     logoUrl: '',
     defaultTaxRate: '0',
   });
 
   const [branch, setBranch] = useState<BranchDetails>({
     name: 'Main Branch',
     address: '',
     phone: '',
     openingTime: '09:00',
     closingTime: '21:00',
   });
 
   const [staff, setStaff] = useState<StaffDetails>({
     name: '',
     phone: '',
     email: '',
   });
 
   const triggerConfetti = () => {
     confetti({
       particleCount: 100,
       spread: 70,
       origin: { y: 0.6 }
     });
   };
 
   const handleComplete = async () => {
     if (!user) return;
     setLoading(true);
 
     try {
       // 1. Create tenant
       const { data: tenantData, error: tenantError } = await supabase
         .from('tenants')
         .insert({
           name: salon.name,
           logo_url: salon.logoUrl || null,
           default_tax_rate: parseFloat(salon.defaultTaxRate) || 0,
           onboarding_completed: true,
         })
         .select()
         .single();
 
       if (tenantError) throw tenantError;
 
       // 2. Update profile with tenant_id
       const { error: profileError } = await supabase
         .from('profiles')
         .update({ tenant_id: tenantData.id })
         .eq('user_id', user.id);
 
       if (profileError) throw profileError;
 
       // 3. Create user role (owner)
       const { error: roleError } = await supabase
         .from('user_roles')
         .insert({
           user_id: user.id,
           tenant_id: tenantData.id,
           role: 'owner',
         });
 
       if (roleError) throw roleError;
 
       // 4. Create branch
       const { data: branchData, error: branchError } = await supabase
         .from('branches')
         .insert({
           tenant_id: tenantData.id,
           name: branch.name,
           address: branch.address,
           phone: branch.phone,
           opening_time: branch.openingTime,
           closing_time: branch.closingTime,
         })
         .select()
         .single();
 
       if (branchError) throw branchError;
 
       // 5. Create first staff member
       const { error: staffError } = await supabase
         .from('staff')
         .insert({
           name: staff.name,
           phone: staff.phone || null,
           email: staff.email || null,
           working_hours_start: branch.openingTime,
           working_hours_end: branch.closingTime,
         });
 
       if (staffError) throw staffError;
 
       // 6. Update profile with branch_id
       await supabase
         .from('profiles')
         .update({ branch_id: branchData.id })
         .eq('user_id', user.id);
 
       triggerConfetti();
       toast.success('🎉 Your salon is ready!');
       await refreshProfile();
       
       setTimeout(() => navigate('/'), 1500);
     } catch (error: any) {
       console.error('Onboarding error:', error);
       toast.error(error.message || 'Failed to complete setup');
     } finally {
       setLoading(false);
     }
   };
 
   const canProceed = () => {
     switch (currentStep) {
       case 1:
         return salon.name.trim().length > 0;
       case 2:
         return branch.name.trim().length > 0;
       case 3:
         return staff.name.trim().length > 0;
       default:
         return false;
     }
   };
 
   return (
     <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-8 px-4">
       <div className="max-w-2xl mx-auto">
         {/* Header */}
         <div className="text-center mb-8">
           <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
             <Sparkles className="w-4 h-4" />
             14-Day Free Trial Active
           </div>
           <h1 className="text-3xl font-bold text-foreground">Set Up Your Salon</h1>
           <p className="text-muted-foreground mt-2">Let's get your salon ready in just a few steps</p>
         </div>
 
         {/* Progress Steps */}
         <div className="flex items-center justify-center mb-8">
           {steps.map((step, index) => (
             <div key={step.id} className="flex items-center">
               <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                 currentStep > step.id 
                   ? 'bg-primary border-primary text-primary-foreground'
                   : currentStep === step.id
                   ? 'border-primary text-primary'
                   : 'border-muted text-muted-foreground'
               }`}>
                 {currentStep > step.id ? (
                   <Check className="w-5 h-5" />
                 ) : (
                   <step.icon className="w-5 h-5" />
                 )}
               </div>
               {index < steps.length - 1 && (
                 <div className={`w-16 h-0.5 mx-2 ${
                   currentStep > step.id ? 'bg-primary' : 'bg-muted'
                 }`} />
               )}
             </div>
           ))}
         </div>
 
         {/* Step Content */}
         <Card className="border-2">
           {currentStep === 1 && (
             <>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <Building2 className="w-5 h-5" />
                   Salon Details
                 </CardTitle>
                 <CardDescription>Tell us about your salon business</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="salon-name">Salon Name *</Label>
                   <Input
                     id="salon-name"
                     placeholder="e.g., Glamour Ladies Salon"
                     value={salon.name}
                     onChange={(e) => setSalon({ ...salon, name: e.target.value })}
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="logo-url">Logo URL (optional)</Label>
                   <Input
                     id="logo-url"
                     placeholder="https://..."
                     value={salon.logoUrl}
                     onChange={(e) => setSalon({ ...salon, logoUrl: e.target.value })}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="tax-rate">Default Tax Rate (%)</Label>
                   <Input
                     id="tax-rate"
                     type="number"
                     min="0"
                     max="100"
                     step="0.001"
                     placeholder="0"
                     value={salon.defaultTaxRate}
                     onChange={(e) => setSalon({ ...salon, defaultTaxRate: e.target.value })}
                   />
                   <p className="text-xs text-muted-foreground">Kuwait typically has 0% VAT</p>
                 </div>
               </CardContent>
             </>
           )}
 
           {currentStep === 2 && (
             <>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <MapPin className="w-5 h-5" />
                   First Branch
                 </CardTitle>
                 <CardDescription>Set up your main branch location</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="branch-name">Branch Name *</Label>
                   <Input
                     id="branch-name"
                     placeholder="e.g., Salmiya Branch"
                     value={branch.name}
                     onChange={(e) => setBranch({ ...branch, name: e.target.value })}
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="branch-address">Address</Label>
                   <Input
                     id="branch-address"
                     placeholder="e.g., Block 5, Street 10, Salmiya"
                     value={branch.address}
                     onChange={(e) => setBranch({ ...branch, address: e.target.value })}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="branch-phone">Phone</Label>
                   <Input
                     id="branch-phone"
                     placeholder="+965 xxxx xxxx"
                     value={branch.phone}
                     onChange={(e) => setBranch({ ...branch, phone: e.target.value })}
                   />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="opening-time">Opening Time</Label>
                     <Input
                       id="opening-time"
                       type="time"
                       value={branch.openingTime}
                       onChange={(e) => setBranch({ ...branch, openingTime: e.target.value })}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="closing-time">Closing Time</Label>
                     <Input
                       id="closing-time"
                       type="time"
                       value={branch.closingTime}
                       onChange={(e) => setBranch({ ...branch, closingTime: e.target.value })}
                     />
                   </div>
                 </div>
               </CardContent>
             </>
           )}
 
           {currentStep === 3 && (
             <>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <User className="w-5 h-5" />
                   First Staff Member
                 </CardTitle>
                 <CardDescription>Add your first stylist or staff member</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="staff-name">Staff Name *</Label>
                   <Input
                     id="staff-name"
                     placeholder="e.g., Fatima Al-Sabah"
                     value={staff.name}
                     onChange={(e) => setStaff({ ...staff, name: e.target.value })}
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="staff-phone">Phone (optional)</Label>
                   <Input
                     id="staff-phone"
                     placeholder="+965 xxxx xxxx"
                     value={staff.phone}
                     onChange={(e) => setStaff({ ...staff, phone: e.target.value })}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="staff-email">Email (optional)</Label>
                   <Input
                     id="staff-email"
                     type="email"
                     placeholder="staff@example.com"
                     value={staff.email}
                     onChange={(e) => setStaff({ ...staff, email: e.target.value })}
                   />
                 </div>
               </CardContent>
             </>
           )}
 
           {/* Navigation Buttons */}
           <div className="flex justify-between p-6 pt-0">
             <Button
               variant="outline"
               onClick={() => setCurrentStep(currentStep - 1)}
               disabled={currentStep === 1}
             >
               <ArrowLeft className="w-4 h-4 mr-2" />
               Back
             </Button>
             
             {currentStep < 3 ? (
               <Button
                 onClick={() => setCurrentStep(currentStep + 1)}
                 disabled={!canProceed()}
               >
                 Next
                 <ArrowRight className="w-4 h-4 ml-2" />
               </Button>
             ) : (
               <Button
                 onClick={handleComplete}
                 disabled={!canProceed() || loading}
               >
                 {loading ? 'Setting up...' : 'Complete Setup'}
                 <Sparkles className="w-4 h-4 ml-2" />
               </Button>
             )}
           </div>
         </Card>
       </div>
     </div>
   );
 };
 
 export default Onboarding;