import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Scissors, Sparkles } from 'lucide-react';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, tenant, userRoles, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // Redirect when authenticated and profile is loaded
  useEffect(() => {
    if (authLoading || !user) return;
    const isSuperAdmin = userRoles.includes('super_admin' as any);
    if (isSuperAdmin) {
      navigate('/admin', { replace: true });
    } else if (tenant?.onboarding_completed) {
      navigate('/dashboard', { replace: true });
    } else if (user) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, tenant, userRoles, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Welcome back!');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Account created! Please check your email to verify your account.');
    }
  };
 
   return (
     <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
       <div className="w-full max-w-md">
         <div className="text-center mb-8">
           <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
             <Scissors className="w-8 h-8" />
           </div>
           <h1 className="text-3xl font-bold text-foreground">SalonFlow</h1>
           <p className="text-muted-foreground mt-2">Ladies Salon Management Platform</p>
         </div>
 
        <Card className="border-2">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Start Free Trial</TabsTrigger>
            </TabsList>
             
             <TabsContent value="signin">
               <form onSubmit={handleSignIn}>
                 <CardHeader>
                   <CardTitle>Welcome Back</CardTitle>
                   <CardDescription>Sign in to manage your salon</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <div className="space-y-2">
                     <Label htmlFor="signin-email">Email</Label>
                     <Input
                       id="signin-email"
                       type="email"
                       placeholder="salon@example.com"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       required
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="signin-password">Password</Label>
                     <Input
                       id="signin-password"
                       type="password"
                       placeholder="••••••••"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       required
                     />
                   </div>
                 </CardContent>
                 <CardFooter>
                   <Button type="submit" className="w-full" disabled={loading}>
                     {loading ? 'Signing in...' : 'Sign In'}
                   </Button>
                 </CardFooter>
               </form>
             </TabsContent>
             
             <TabsContent value="signup">
               <form onSubmit={handleSignUp}>
                 <CardHeader>
             <CardTitle className="flex items-center gap-2">
                     Start Your 14-Day Free Trial
                     <Sparkles className="w-5 h-5 text-primary" />
                   </CardTitle>
                   <CardDescription>
                     Full access to Professional features. No credit card required.
                   </CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <div className="space-y-2">
                     <Label htmlFor="signup-name">Full Name</Label>
                     <Input
                       id="signup-name"
                       type="text"
                       placeholder="Fatima Al-Ahmad"
                       value={fullName}
                       onChange={(e) => setFullName(e.target.value)}
                       required
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="signup-email">Email</Label>
                     <Input
                       id="signup-email"
                       type="email"
                       placeholder="salon@example.com"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       required
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="signup-password">Password</Label>
                     <Input
                       id="signup-password"
                       type="password"
                       placeholder="••••••••"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       required
                       minLength={6}
                     />
                   </div>
                 </CardContent>
                 <CardFooter className="flex-col gap-4">
                   <Button type="submit" className="w-full" disabled={loading}>
                     {loading ? 'Creating account...' : 'Start Free Trial'}
                   </Button>
                   <p className="text-xs text-muted-foreground text-center">
                     By signing up, you agree to our Terms of Service and Privacy Policy
                   </p>
                 </CardFooter>
               </form>
             </TabsContent>
           </Tabs>
         </Card>
 
         <div className="mt-6 text-center">
           <p className="text-sm text-muted-foreground">
             Looking to book an appointment?{' '}
             <a href="/book" className="text-primary hover:underline font-medium">
               Book Online →
             </a>
           </p>
         </div>
       </div>
     </div>
   );
 };
 
 export default Auth;