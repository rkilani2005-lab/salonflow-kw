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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface DiscountApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discountAmount: number;
  discountReason: string;
  onApproved: (approverUserId: string) => void;
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
  const { tenant } = useAuth();
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      // Sign in with the manager credentials to verify
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        toast({ title: 'Invalid credentials', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId || !tenant?.id) {
        toast({ title: 'Authentication failed', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Check if user has manager or owner role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenant.id)
        .in('role', ['manager', 'owner']);

      if (!roles || roles.length === 0) {
        toast({ title: 'Not authorized', description: 'Only managers or owners can approve discounts.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      onApproved(userId);
      onOpenChange(false);
      setEmail('');
      setPassword('');
      toast({ title: 'Discount approved' });
    } catch (err: any) {
      toast({ title: 'Verification failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
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
          <div className="space-y-2">
            <Label>Manager Email</Label>
            <Input
              type="email"
              placeholder="manager@salon.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
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
