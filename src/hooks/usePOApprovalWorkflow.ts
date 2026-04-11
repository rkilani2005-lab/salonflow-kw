import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface POApprovalRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  min_amount: number;
  max_amount: number | null;
  allowed_roles: string[];
  specific_approvers: string[] | null;
  require_two_approvers: boolean;
  four_eyes_enforced: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberOption {
  user_id: string;
  full_name: string | null;
  role: string;
}

// ── Fetch all rules for the tenant ────────────────────────────
export function usePOApprovalRules() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['po_approval_rules', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('po_approval_rules')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('sort_order');
      if (error) throw error;
      return data as POApprovalRule[];
    },
    enabled: !!tenant?.id,
  });
}

// ── Get the matching rule for a specific PO amount ─────────────
export function useMatchingRule(amount: number) {
  const { data: rules = [] } = usePOApprovalRules();
  // Find the most specific rule: highest min_amount that is <= PO amount
  const active = rules.filter(r => r.is_active && r.min_amount <= amount);
  active.sort((a, b) => b.min_amount - a.min_amount);
  return active[0] ?? null;
}

// ── Fetch team members (owners + managers) for approver picker ─
export function useApproverOptions() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['approver_options', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role, profiles:user_id(full_name, phone)')
        .eq('tenant_id', tenant!.id)
        .in('role', ['owner', 'manager']);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        user_id: r.user_id,
        full_name: r.profiles?.full_name ?? null,
        role: r.role,
      })) as TeamMemberOption[];
    },
    enabled: !!tenant?.id,
  });
}

// ── Check if the current user can approve a specific PO ────────
export function useCanApprove(poAmount: number, requestedByUserId: string | null) {
  const { user, userRoles } = useAuth();
  const rule = useMatchingRule(poAmount);

  if (!rule || !user) return { canApprove: false, rule: null, reason: 'No rule configured' };

  const isRequester = requestedByUserId === user.id;
  if (rule.four_eyes_enforced && isRequester) {
    return { canApprove: false, rule, reason: '4-eyes: you submitted this PO' };
  }

  // Check role
  const hasRequiredRole = rule.allowed_roles.some(r => userRoles.includes(r as any) || userRoles.includes('owner' as any));
  if (!hasRequiredRole) {
    return { canApprove: false, rule, reason: `Requires role: ${rule.allowed_roles.join(' or ')}` };
  }

  // Check specific approvers list (if set)
  if (rule.specific_approvers && rule.specific_approvers.length > 0) {
    if (!rule.specific_approvers.includes(user.id)) {
      return { canApprove: false, rule, reason: 'You are not in the named approvers list' };
    }
  }

  return { canApprove: true, rule, reason: null };
}

// ── Create rule ───────────────────────────────────────────────
export function useCreatePORule() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<POApprovalRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('po_approval_rules').insert({
        ...data,
        tenant_id: tenant!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['po_approval_rules'] });
      toast({ title: 'Approval rule created' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });
}

// ── Update rule ───────────────────────────────────────────────
export function useUpdatePORule() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<POApprovalRule> & { id: string }) => {
      const { error } = await supabase
        .from('po_approval_rules')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['po_approval_rules'] });
      toast({ title: 'Rule updated' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });
}

// ── Delete rule ───────────────────────────────────────────────
export function useDeletePORule() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('po_approval_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['po_approval_rules'] });
      toast({ title: 'Rule deleted' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });
}
