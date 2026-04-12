import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff, Lock } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user, userRoles, loading: authLoading, signIn, signOut } = useAuth();
  const navigate = useNavigate();

  // If already logged in as super_admin → go to admin dashboard
  // If logged in as regular user → sign them out (wrong portal)
  useEffect(() => {
    if (authLoading || !user) return;
    if (userRoles.includes('super_admin' as any)) {
      navigate('/zaina-admin', { replace: true });
    } else {
      // Regular user tried the admin portal — sign out and show error
      signOut().then(() => {
        toast.error('Access denied. This portal is for ZAINA administrators only.');
      });
    }
  }, [user, userRoles, authLoading, navigate, signOut]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error('Invalid credentials. Admin access only.');
    }
    // Redirect handled by useEffect above after role check
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-5">
            <Shield className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            ZAINA Admin
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Restricted access — authorized personnel only</p>
        </div>

        {/* Form card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-zinc-300">
                Admin Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@zaina.ai"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="h-10 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-red-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-zinc-300">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-10 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-red-500/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold mt-2"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Sign In to Admin Panel
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-zinc-600 mt-6">
          Salon owners →{' '}
          <a href="/auth" className="text-zinc-500 hover:text-zinc-300 underline transition-colors">
            Sign in here
          </a>
        </p>

        {/* Security warning */}
        <div className="mt-4 flex items-start gap-2 bg-amber-950/30 border border-amber-900/40 rounded-xl px-3 py-2.5">
          <Shield className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700/80">
            All login attempts are logged. Unauthorized access attempts will be reported.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
