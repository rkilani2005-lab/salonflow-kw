import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Scissors, Sparkles, Eye, EyeOff, ArrowRight, CheckCircle2, Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  getBiometryKind,
  saveCredentialsForBiometric,
  unlockWithBiometric,
} from '@/lib/native/biometric';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const isSignup = searchParams.get('mode') === 'signup';
  const [mode, setMode] = useState<'signin' | 'signup'>(isSignup ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  // Biometric state — only ever truthy on native.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled,   setBioEnabled]   = useState(false);
  const [bioKind,      setBioKind]      = useState<'face'|'fingerprint'|'iris'|'unknown'>('unknown');

  useEffect(() => {
    // Detect biometric support once on mount.  No-ops to false on web.
    (async () => {
      const avail  = await isBiometricAvailable();
      const kind   = await getBiometryKind();
      const enrol  = await isBiometricEnabled();
      setBioAvailable(avail);
      setBioKind(kind);
      setBioEnabled(enrol);
    })();
  }, []);

  const { user, tenant, userRoles, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !user) return;
    // Super admins who land on the tenant auth page get sent to their own portal
    if (userRoles.includes('super_admin' as any)) { navigate('/zaina-admin', { replace: true }); return; }
    if (tenant?.onboarding_completed) { navigate('/dashboard', { replace: true }); return; }
    navigate('/onboarding', { replace: true });
  }, [user, tenant, userRoles, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Welcome back!');
    // On first successful password login on a native device with
    // biometric hardware, stash the credentials in the platform
    // keystore so future sessions can skip the password.  We don't
    // ask the user — the presence of a fingerprint/face on the device
    // is implicit consent to use it; if they dislike it they can
    // toggle off in settings.
    if (bioAvailable && !bioEnabled) {
      try {
        await saveCredentialsForBiometric(email, password);
        setBioEnabled(true);
      } catch { /* non-fatal */ }
    }
  };

  const handleBiometricUnlock = async () => {
    setLoading(true);
    const creds = await unlockWithBiometric();
    if (!creds) {
      setLoading(false);
      return; // user cancelled or biometric failed
    }
    const { error } = await signIn(creds.email, creds.password);
    setLoading(false);
    if (error) {
      toast.error('Stored credentials no longer work. Please sign in with password.');
      return;
    }
    toast.success('Welcome back!');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast.error('Please enter your full name'); return; }
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success('Account created! Check your email to verify.');
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Form ── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full lg:max-w-none lg:mx-0 lg:px-16 xl:px-24">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 mb-12 group w-fit">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Scissors className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>ZAINA</span>
        </Link>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {mode === 'signin' ? 'Welcome back' : 'Start your free trial'}
          </h1>
          <p className="text-muted-foreground">
            {mode === 'signin'
              ? 'Sign in to your ZAINA dashboard'
              : '14 days free · No credit card · Cancel anytime'}
          </p>
        </div>

        {/* Toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-8">
          {(['signin', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-150',
                mode === m ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
              <Input
                id="fullName" placeholder="Your full name" value={fullName}
                onChange={e => setFullName(e.target.value)} required
                className="h-10"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
            <Input
              id="email" type="email" placeholder="you@salon.com" value={email}
              onChange={e => setEmail(e.target.value)} required className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password" type={showPass ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                value={password} onChange={e => setPassword(e.target.value)} required
                className="h-10 pr-10"
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-10 gap-2 font-semibold mt-2">
            {loading ? (
              <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {/* Biometric unlock — native-only, only after the user has
              at least one password login under their belt so we have
              credentials to unlock to.  Hidden on web and on fresh
              installs; appears after first successful sign-in. */}
          {mode === 'signin' && bioAvailable && bioEnabled && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handleBiometricUnlock}
              className="w-full h-10 gap-2 font-medium"
            >
              <Fingerprint className="h-4 w-4" />
              {bioKind === 'face'        ? 'Unlock with Face ID' :
               bioKind === 'fingerprint' ? 'Unlock with fingerprint' :
                                           'Unlock with biometric'}
            </Button>
          )}
        </form>

        {/* Sign up benefits */}
        {mode === 'signup' && (
          <div className="mt-6 space-y-2">
            {['14-day free trial, no credit card', 'Setup in under 5 minutes', 'Full Arabic & English support'].map(b => (
              <div key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                {b}
              </div>
            ))}
          </div>
        )}

        {/* Admin portal link — subtle, not prominent */}
        <p className="mt-8 text-center text-xs text-muted-foreground/50">
          ZAINA administrator?{' '}
          <a href="/zaina-admin/login" className="hover:text-muted-foreground transition-colors underline underline-offset-2">
            Admin portal
          </a>
        </p>
      </div>

      {/* ── Right: Visual panel (desktop only) ── */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-accent relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 grid-overlay opacity-10" />
        <div className="relative z-10 text-white text-center px-12 max-w-lg">
          <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 mb-8 text-sm font-semibold">
            <Sparkles className="h-4 w-4" />
            AI-Powered Salon Management
          </div>
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            The smarter way to run your salon
          </h2>
          <p className="text-white/75 text-lg mb-10 leading-relaxed">
            Join 500+ salons across Kuwait & GCC using ZAINA to automate bookings, grow revenue, and delight clients.
          </p>
          <div className="grid grid-cols-2 gap-4 text-left">
            {[
              { stat: '+40%', label: 'Average revenue increase' },
              { stat: '80%', label: 'Bookings automated by AI' },
              { stat: '500+', label: 'Active salons' },
              { stat: '14d', label: 'Free trial, no card' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold stat-number">{s.stat}</p>
                <p className="text-white/70 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
