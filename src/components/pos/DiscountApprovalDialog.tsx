import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';

interface DiscountApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discountAmount: number;
  discountReason: string;
  onApproved: (approverUserId: string) => void;
}

// ── Isolated verify-only client ──────────────────────────────────
// CRITICAL: calling supabase.auth.signInWithPassword on the main client
// would REPLACE the cashier's session with the manager's session.  Every
// subsequent action — including the POS transaction that follows the
// approval — would be recorded under the manager's user_id, and the
// cashier's terminal would stay logged in as the manager.  The fix is
// to verify credentials on a throwaway client that never persists
// session state anywhere, leaving the main client untouched.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function createVerifyClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession:     false,  // do not write to localStorage
      autoRefreshToken:   false,  // do not schedule refreshes
      detectSessionInUrl: false,
    },
  });
}

// Throttle: the same device can attempt at most N verifications per minute.
// Prevents brute-force guessing against the manager's credentials.
const ATTEMPT_WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 5;
const attemptTimestamps: number[] = [];

function recordAttempt(): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  // Drop attempts older than the window
  while (attemptTimestamps.length && now - attemptTimestamps[0] > ATTEMPT_WINDOW_MS) {
    attemptTimestamps.shift();
  }
  if (attemptTimestamps.length >= MAX_ATTEMPTS_PER_WINDOW) {
    const retryAfterSec = Math.ceil((ATTEMPT_WINDOW_MS - (now - attemptTimestamps[0])) / 1000);
    return { allowed: false, retryAfterSec };
  }
  attemptTimestamps.push(now);
  return { allowed: true, retryAfterSec: 0 };
}

export function DiscountApprovalDialog({
  open,
  onOpenChange,
  discountAmount,
  discountReason,
  onApproved,
}: DiscountApprovalDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [throttleMsg, setThrottleMsg] = useState<string | null>(null);
  const { tenant, user: currentUser } = useAuth();
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!email || !password) return;

    // Rate-limit brute-force attempts
    const gate = recordAttempt();
    if (!gate.allowed) {
      setThrottleMsg(`Too many attempts. Please wait ${gate.retryAfterSec}s before trying again.`);
      return;
    }
    setThrottleMsg(null);

    setLoading(true);
    const verifyClient = createVerifyClient();
    try {
      // Verify manager credentials WITHOUT touching the main session.
      const { data: authData, error: authError } = await verifyClient.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        toast({ title: 'Invalid credentials', variant: 'destructive' });
        return;
      }

      const approverId = authData.user.id;

      // Self-approval guard: a cashier cannot approve their own discount.
      if (currentUser?.id && approverId === currentUser.id) {
        toast({
          title: 'Self-approval not allowed',
          description: 'A different manager must approve this discount.',
          variant: 'destructive',
        });
        return;
      }

      // Check role on the main (cashier) client — RLS enforces tenant scope.
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', approverId)
        .eq('tenant_id', tenant?.id || '')
        .in('role', ['manager', 'owner']);

      if (!roles || roles.length === 0) {
        toast({
          title: 'Not authorized',
          description: 'Only managers or owners can approve discounts.',
          variant: 'destructive',
        });
        return;
      }

      // Best-effort audit trail (silent if table absent in this tenant).
      try {
        await (supabase as any).from('discount_approvals').insert({
          tenant_id:   tenant?.id,
          approver_id: approverId,
          cashier_id:  currentUser?.id ?? null,
          amount:      discountAmount,
          reason:      discountReason,
        });
      } catch { /* audit-only table, don't block approval */ }

      onApproved(approverId);
      onOpenChange(false);
      setEmail('');
      setPassword('');
      toast({ title: 'Discount approved' });
    } catch (err: any) {
      toast({ title: 'Verification failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      // Important: sign the verify client out so no token lingers in memory.
      try { await verifyClient.auth.signOut(); } catch { /* ignore */ }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Manager Approval Required
          </DialogTitle>
          <DialogDescription>
            A discount of <strong>{discountAmount.toFixed(3)} KWD</strong> requires manager authorization.
            {discountReason && <> Reason: {discountReason}</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {throttleMsg && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 text-destructive text-xs px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{throttleMsg}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>Manager Email</Label>
            <Input
              type="email"
              placeholder="manager@salon.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-base"
              autoComplete="new-password"
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
          </div>
          <Button
            onClick={handleVerify}
            className="w-full h-12 text-base"
            disabled={loading || !email || !password}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve Discount
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
