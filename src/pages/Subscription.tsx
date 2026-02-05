 import { useAuth } from '@/contexts/AuthContext';
 import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Check, X, Sparkles, Crown, Zap, Calendar, Users, Scissors, CreditCard, Package, BarChart3, Bot, Lock } from 'lucide-react';
 import { differenceInDays, format } from 'date-fns';
 import { cn } from '@/lib/utils';
 
 type PlanFeature = {
   name: string;
   icon: React.ComponentType<{ className?: string }>;
   starter: boolean;
   professional: boolean;
   ai: boolean;
 };
 
 const features: PlanFeature[] = [
   { name: 'Calendar & Bookings', icon: Calendar, starter: true, professional: true, ai: true },
   { name: 'Client Management', icon: Users, starter: true, professional: true, ai: true },
   { name: 'Staff Management', icon: Users, starter: true, professional: true, ai: true },
   { name: 'Service Catalog', icon: Scissors, starter: true, professional: true, ai: true },
   { name: 'Point of Sale', icon: CreditCard, starter: true, professional: true, ai: true },
   { name: 'Basic Reports', icon: BarChart3, starter: true, professional: true, ai: true },
   { name: 'Multiple Branches', icon: Package, starter: false, professional: true, ai: true },
   { name: 'Advanced Analytics', icon: BarChart3, starter: false, professional: true, ai: true },
   { name: 'Custom Forms', icon: Scissors, starter: false, professional: true, ai: true },
   { name: 'Inventory Management', icon: Package, starter: false, professional: true, ai: true },
   { name: 'Commission Engine', icon: CreditCard, starter: false, professional: true, ai: true },
   { name: 'AI Appointment Suggestions', icon: Bot, starter: false, professional: false, ai: true },
   { name: 'AI Client Insights', icon: Bot, starter: false, professional: false, ai: true },
   { name: 'AI Revenue Forecasting', icon: Bot, starter: false, professional: false, ai: true },
   { name: 'Smart Scheduling', icon: Bot, starter: false, professional: false, ai: true },
 ];
 
 const plans = [
   {
     id: 'starter',
     name: 'Starter',
     price: 29,
     description: 'Perfect for small salons getting started',
     icon: Sparkles,
     popular: false,
   },
   {
     id: 'professional',
     name: 'Professional',
     price: 45,
     description: 'For growing salons with multiple branches',
     icon: Crown,
     popular: true,
   },
   {
     id: 'ai',
     name: 'AI Premium',
     price: 59,
     description: 'Unlock the power of AI for your salon',
     icon: Zap,
     popular: false,
   },
 ];
 
 const Subscription = () => {
   const { tenant } = useAuth();
   
   const currentPlan = tenant?.subscription_plan || 'starter';
   const isTrialActive = tenant?.is_trial && tenant?.trial_ends_at && new Date(tenant.trial_ends_at) > new Date();
   const trialDaysLeft = tenant?.trial_ends_at 
     ? Math.max(0, differenceInDays(new Date(tenant.trial_ends_at), new Date()))
     : 0;
   const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
 
   const getPlanLevel = (plan: string) => {
     const levels: Record<string, number> = { starter: 1, professional: 2, ai: 3 };
     return levels[plan] || 0;
   };
 
   const canUpgrade = (planId: string) => {
     return getPlanLevel(planId) > getPlanLevel(currentPlan);
   };
 
   const isCurrentPlan = (planId: string) => {
     return planId === currentPlan && !isTrialActive;
   };
 
   const handleUpgrade = (planId: string) => {
     // TODO: Implement Stripe checkout
     console.log('Upgrade to:', planId);
   };
 
   return (
     <div className="container max-w-6xl py-8 space-y-8">
       {/* Header */}
       <div className="text-center space-y-2">
         <h1 className="text-3xl font-bold">Subscription & Billing</h1>
         <p className="text-muted-foreground">
           Choose the perfect plan for your salon
         </p>
       </div>
 
       {/* Trial Banner */}
       {isTrialActive && (
         <Card className="border-primary bg-primary/5">
           <CardContent className="flex items-center justify-between py-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                 <Sparkles className="h-5 w-5 text-primary" />
               </div>
               <div>
                 <p className="font-semibold">You're on a 14-day Professional Trial</p>
                 <p className="text-sm text-muted-foreground">
                   {trialDaysLeft} days remaining • Ends {trialEndsAt && format(trialEndsAt, 'MMM d, yyyy')}
                 </p>
               </div>
             </div>
             <Button onClick={() => handleUpgrade('professional')}>
               Upgrade Now
             </Button>
           </CardContent>
         </Card>
       )}
 
       {/* Current Plan Status */}
       {!isTrialActive && (
         <Card>
           <CardContent className="flex items-center justify-between py-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                 {currentPlan === 'ai' ? (
                   <Zap className="h-5 w-5" />
                 ) : currentPlan === 'professional' ? (
                   <Crown className="h-5 w-5" />
                 ) : (
                   <Sparkles className="h-5 w-5" />
                 )}
               </div>
               <div>
                 <p className="font-semibold">
                   Current Plan: {plans.find(p => p.id === currentPlan)?.name || 'Starter'}
                 </p>
                 <p className="text-sm text-muted-foreground">
                   {currentPlan === 'ai' ? 'All features unlocked' : 'Upgrade to unlock more features'}
                 </p>
               </div>
             </div>
             {currentPlan !== 'ai' && (
               <Button variant="outline" onClick={() => handleUpgrade('ai')}>
                 View Upgrade Options
               </Button>
             )}
           </CardContent>
         </Card>
       )}
 
       {/* Pricing Cards */}
       <div className="grid md:grid-cols-3 gap-6">
         {plans.map((plan) => {
           const isCurrent = isCurrentPlan(plan.id);
           const canUpgradeToPlan = canUpgrade(plan.id);
           const Icon = plan.icon;
           
           return (
             <Card 
               key={plan.id} 
               className={cn(
                 "relative",
                 plan.popular && "border-primary shadow-lg",
                  isCurrent && "border-primary/50 bg-primary/5"
                )}
             >
               {plan.popular && (
                 <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                   Most Popular
                 </Badge>
               )}
               {isCurrent && (
                <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                   Current Plan
                 </Badge>
               )}
               
               <CardHeader className="text-center pb-2">
                 <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                   <Icon className="h-6 w-6" />
                 </div>
                 <CardTitle>{plan.name}</CardTitle>
                 <CardDescription>{plan.description}</CardDescription>
               </CardHeader>
               
               <CardContent className="text-center">
                 <div className="mb-4">
                   <span className="text-4xl font-bold">{plan.price}</span>
                   <span className="text-muted-foreground"> KWD/mo</span>
                 </div>
                 
                 <ul className="space-y-2 text-sm text-left">
                   {features.slice(0, 6).map((feature) => {
                     const hasFeature = feature[plan.id as keyof typeof feature] as boolean;
                     return (
                       <li key={feature.name} className="flex items-center gap-2">
                         {hasFeature ? (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                           <X className="h-4 w-4 text-muted-foreground shrink-0" />
                         )}
                         <span className={cn(!hasFeature && "text-muted-foreground")}>
                           {feature.name}
                         </span>
                       </li>
                     );
                   })}
                   {plan.id !== 'starter' && (
                     <li className="text-primary font-medium pt-1">
                       + {plan.id === 'ai' ? '9' : '5'} more features
                     </li>
                   )}
                 </ul>
               </CardContent>
               
               <CardFooter>
                 {isCurrent ? (
                   <Button variant="outline" className="w-full" disabled>
                     Current Plan
                   </Button>
                 ) : canUpgradeToPlan ? (
                   <Button 
                     className="w-full" 
                     variant={plan.popular ? "default" : "outline"}
                     onClick={() => handleUpgrade(plan.id)}
                   >
                     Upgrade to {plan.name}
                   </Button>
                 ) : (
                   <Button variant="ghost" className="w-full" disabled>
                     Included in your plan
                   </Button>
                 )}
               </CardFooter>
             </Card>
           );
         })}
       </div>
 
       {/* Feature Comparison */}
       <Card>
         <CardHeader>
           <CardTitle>Feature Comparison</CardTitle>
           <CardDescription>See what's included in each plan</CardDescription>
         </CardHeader>
         <CardContent>
           <div className="overflow-x-auto">
             <table className="w-full">
               <thead>
                 <tr className="border-b">
                   <th className="text-left py-3 px-4 font-medium">Feature</th>
                   <th className="text-center py-3 px-4 font-medium">Starter</th>
                   <th className="text-center py-3 px-4 font-medium">Professional</th>
                   <th className="text-center py-3 px-4 font-medium">AI Premium</th>
                 </tr>
               </thead>
               <tbody>
                 {features.map((feature, index) => {
                   const Icon = feature.icon;
                   const isLocked = (plan: 'starter' | 'professional' | 'ai') => {
                     if (isTrialActive) return !feature.professional && !feature.ai;
                     return !feature[plan] && getPlanLevel(plan) <= getPlanLevel(currentPlan);
                   };
                   
                   return (
                     <tr key={feature.name} className={cn(index % 2 === 0 && "bg-muted/30")}>
                       <td className="py-3 px-4">
                         <div className="flex items-center gap-2">
                           <Icon className="h-4 w-4 text-muted-foreground" />
                           <span>{feature.name}</span>
                         </div>
                       </td>
                       <td className="text-center py-3 px-4">
                         {feature.starter ? (
                            <Check className="h-5 w-5 text-primary mx-auto" />
                         ) : (
                           <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
                         )}
                       </td>
                       <td className="text-center py-3 px-4">
                         {feature.professional ? (
                            <Check className="h-5 w-5 text-primary mx-auto" />
                         ) : (
                           <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
                         )}
                       </td>
                       <td className="text-center py-3 px-4">
                         {feature.ai ? (
                            <Check className="h-5 w-5 text-primary mx-auto" />
                         ) : (
                           <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
                         )}
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>
         </CardContent>
       </Card>
 
       {/* CTA Section */}
       {currentPlan !== 'ai' && (
         <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
           <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4 py-6">
             <div className="text-center md:text-left">
               <h3 className="text-xl font-bold mb-1">Ready to unlock all features?</h3>
               <p className="text-muted-foreground">
                 Upgrade to AI Premium and supercharge your salon with AI-powered insights
               </p>
             </div>
             <Button size="lg" onClick={() => handleUpgrade('ai')}>
               <Zap className="mr-2 h-4 w-4" />
               Upgrade to AI Premium
             </Button>
           </CardContent>
         </Card>
       )}
     </div>
   );
 };
 
 export default Subscription;