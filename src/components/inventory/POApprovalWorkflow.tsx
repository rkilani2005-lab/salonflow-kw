import { useState } from 'react';
import {
  usePOApprovalRules, useCreatePORule, useUpdatePORule, useDeletePORule,
  useApproverOptions, type POApprovalRule,
} from '@/hooks/usePOApprovalWorkflow';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Pencil, Trash2, Shield, Users, ChevronRight,
  AlertCircle, CheckCircle2, Loader2, ArrowRight, Crown, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Role display config ────────────────────────────────────────
const ROLE_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  owner:   { label: 'Owner',   color: 'text-amber-600',  icon: <Crown className="h-3 w-3" /> },
  manager: { label: 'Manager', color: 'text-violet-600', icon: <ShieldCheck className="h-3 w-3" /> },
};

// ── Blank rule template ───────────────────────────────────────
const blankRule = (): Omit<POApprovalRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> => ({
  name: '',
  description: null,
  min_amount: 0,
  max_amount: null,
  allowed_roles: ['owner', 'manager'],
  specific_approvers: null,
  require_two_approvers: false,
  four_eyes_enforced: true,
  is_active: true,
  sort_order: 99,
});

// ── Rule form (create / edit) ─────────────────────────────────
interface RuleFormProps {
  open: boolean;
  onClose: () => void;
  existing?: POApprovalRule | null;
}

function RuleForm({ open, onClose, existing }: RuleFormProps) {
  const { data: approverOptions = [] } = useApproverOptions();
  const createRule = useCreatePORule();
  const updateRule = useUpdatePORule();
  const isSaving = createRule.isPending || updateRule.isPending;

  const [form, setForm] = useState<ReturnType<typeof blankRule>>(
    existing
      ? {
          name: existing.name,
          description: existing.description,
          min_amount: existing.min_amount,
          max_amount: existing.max_amount,
          allowed_roles: existing.allowed_roles,
          specific_approvers: existing.specific_approvers,
          require_two_approvers: existing.require_two_approvers,
          four_eyes_enforced: existing.four_eyes_enforced,
          is_active: existing.is_active,
          sort_order: existing.sort_order,
        }
      : blankRule()
  );

  const set = (key: keyof typeof form, val: unknown) =>
    setForm(f => ({ ...f, [key]: val }));

  const toggleRole = (role: string) =>
    set('allowed_roles', form.allowed_roles.includes(role)
      ? form.allowed_roles.filter(r => r !== role)
      : [...form.allowed_roles, role]);

  const toggleApprover = (uid: string) => {
    const curr = form.specific_approvers ?? [];
    set('specific_approvers', curr.includes(uid) ? curr.filter(u => u !== uid) || null : [...curr, uid]);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (existing) {
      updateRule.mutate({ id: existing.id, ...form }, { onSuccess: onClose });
    } else {
      createRule.mutate(form, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            {existing ? 'Edit Approval Rule' : 'New Approval Rule'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Rule Name *</Label>
            <Input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Standard, High-Value, Emergency"
              className="h-9"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value || null)}
              placeholder="e.g. POs under 500 KWD"
              className="h-9"
            />
          </div>

          {/* Spend range */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Spend Threshold (KWD)</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">From</p>
                <Input
                  type="number" min={0} step={0.001}
                  value={form.min_amount}
                  onChange={e => set('min_amount', parseFloat(e.target.value) || 0)}
                  className="h-9 font-mono"
                />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground mt-5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Up to (leave blank = no limit)</p>
                <Input
                  type="number" min={0} step={0.001}
                  value={form.max_amount ?? ''}
                  placeholder="No limit"
                  onChange={e => set('max_amount', e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-9 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Allowed roles */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Who Can Approve — by Role</Label>
            <div className="flex gap-2">
              {(['owner', 'manager'] as const).map(role => {
                const cfg = ROLE_CFG[role];
                const active = form.allowed_roles.includes(role);
                return (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                      active
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    )}>
                    <span className={active ? 'text-primary' : cfg.color}>{cfg.icon}</span>
                    {cfg.label}
                    {active && <CheckCircle2 className="h-3.5 w-3.5 ml-1" />}
                  </button>
                );
              })}
            </div>
            {form.allowed_roles.length === 0 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> At least one role must be selected
              </p>
            )}
          </div>

          {/* Named approvers (optional override) */}
          {approverOptions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Named Approvers
                <span className="font-normal text-muted-foreground ml-1">(optional — leave blank to allow any matching role)</span>
              </Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {approverOptions.map(m => {
                  const selected = (form.specific_approvers ?? []).includes(m.user_id);
                  const cfg = ROLE_CFG[m.role];
                  return (
                    <button
                      key={m.user_id}
                      onClick={() => toggleApprover(m.user_id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      )}>
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                        selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      )}>
                        {(m.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{m.full_name || 'Unknown'}</p>
                        <p className={cn('text-xs flex items-center gap-1', cfg.color)}>
                          {cfg.icon}{cfg.label}
                        </p>
                      </div>
                      {selected && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {(form.specific_approvers?.length ?? 0) > 0 && (
                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Only the {form.specific_approvers!.length} selected person{form.specific_approvers!.length > 1 ? 's' : ''} can approve — role check is bypassed
                </p>
              )}
            </div>
          )}

          {/* Options */}
          <div className="space-y-3 pt-1">
            <Label className="text-xs font-semibold">Options</Label>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div>
                <p className="text-sm font-medium">4-Eyes Principle</p>
                <p className="text-xs text-muted-foreground">Requester cannot approve their own PO</p>
              </div>
              <Switch
                checked={form.four_eyes_enforced}
                onCheckedChange={v => set('four_eyes_enforced', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div>
                <p className="text-sm font-medium">Require Two Approvers</p>
                <p className="text-xs text-muted-foreground">Both a manager AND an owner must approve</p>
              </div>
              <Switch
                checked={form.require_two_approvers}
                onCheckedChange={v => set('require_two_approvers', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div>
                <p className="text-sm font-medium">Rule Active</p>
                <p className="text-xs text-muted-foreground">Disabled rules are skipped</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => set('is_active', v)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !form.name.trim() || form.allowed_roles.length === 0}
            className="min-w-[100px] gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {existing ? 'Save Changes' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main workflow builder ────────────────────────────────────
export function POApprovalWorkflow() {
  const { hasRole } = useAuth();
  const { data: rules = [], isLoading, isError } = usePOApprovalRules();
  const { data: approverOptions = [] } = useApproverOptions();
  const deleteRule = useDeletePORule();
  const updateRule = useUpdatePORule();

  const [formOpen,     setFormOpen]     = useState(false);
  const [editTarget,   setEditTarget]   = useState<POApprovalRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<POApprovalRule | null>(null);

  const canEdit = hasRole('owner') || hasRole('manager');

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit   = (r: POApprovalRule) => { setEditTarget(r); setFormOpen(true); };

  const getUserName = (uid: string) =>
    approverOptions.find(m => m.user_id === uid)?.full_name ?? 'Unknown';

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
    </div>
  );

  if (isError) return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-6 text-center space-y-3">
      <Shield className="h-8 w-8 text-amber-500 mx-auto" />
      <div>
        <p className="font-semibold text-amber-800 dark:text-amber-300">Approval workflow table not set up yet</p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-1 max-w-md mx-auto">
          The <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">po_approval_rules</code> table
          needs to be created by running the pending migration{' '}
          <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">20260411200001_po_approval_workflow.sql</code>{' '}
          in your Supabase database.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-1">Inventory</p>
          <h2 className="text-2xl font-black leading-none" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.03em' }}>
            PO Approval Workflow
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Define who can approve Purchase Orders based on spend amount. Rules apply from lowest to highest threshold.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="gap-2 flex-shrink-0">
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        )}
      </div>

      {/* How it works callout */}
      <div className="rounded-xl border bg-primary/5 border-primary/15 p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">How the workflow works</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              When a PO is submitted for approval, ZAINA finds the rule with the highest
              <strong> minimum threshold</strong> that is ≤ the PO amount. That rule determines
              who can approve. If no rule matches, any owner or manager can approve.
              The <strong>4-eyes principle</strong> prevents the requester from approving their own PO.
            </p>
          </div>
        </div>
      </div>

      {/* Flow diagram */}
      {rules.filter(r => r.is_active).length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Active Rules — Spend Flow</p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">
              📋 PO Created
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {rules
              .filter(r => r.is_active)
              .sort((a, b) => a.min_amount - b.min_amount)
              .map((rule, i, arr) => (
                <div key={rule.id} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <div className="px-3 py-1.5 rounded-lg border-2 border-primary/30 bg-primary/5 text-xs font-semibold text-center">
                      <span className="text-muted-foreground">≥</span> {rule.min_amount.toFixed(0)} KWD
                      {rule.max_amount && <span className="text-muted-foreground"> – {rule.max_amount.toFixed(0)}</span>}
                    </div>
                    <p className="text-[9px] text-primary font-medium text-center max-w-24 leading-tight">{rule.name}</p>
                  </div>
                  {i < arr.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </div>
              ))}
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approved
            </div>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-25" />
          <p className="font-semibold">No approval rules configured</p>
          <p className="text-xs mt-1 mb-4">Without rules, any owner or manager can approve any PO.</p>
          {canEdit && (
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />Add First Rule
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            const namedApprovers = (rule.specific_approvers ?? []).map(uid => getUserName(uid));
            return (
              <div key={rule.id} className={cn(
                'rounded-xl border bg-card p-5 transition-all',
                !rule.is_active && 'opacity-50',
              )}>
                <div className="flex items-start gap-4">
                  {/* Left: spend range pill */}
                  <div className={cn(
                    'flex-shrink-0 rounded-lg px-3 py-2 text-center min-w-20',
                    rule.is_active ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="font-black stat-number text-sm text-primary">
                      {rule.min_amount.toFixed(0)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">KWD</p>
                    {rule.max_amount != null && (
                      <>
                        <p className="text-[9px] text-muted-foreground mt-0.5">to</p>
                        <p className="font-black stat-number text-sm text-primary">{rule.max_amount.toFixed(0)}</p>
                        <p className="text-[9px] text-muted-foreground">KWD</p>
                      </>
                    )}
                    {rule.max_amount == null && (
                      <p className="text-[9px] text-muted-foreground mt-0.5">& above</p>
                    )}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="font-semibold">{rule.name}</p>
                      {!rule.is_active && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">Disabled</Badge>
                      )}
                      {rule.require_two_approvers && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-violet-200 text-violet-600 dark:border-violet-800 dark:text-violet-400">
                          2 approvers
                        </Badge>
                      )}
                      {rule.four_eyes_enforced && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-200 text-amber-600 dark:border-amber-800 dark:text-amber-400">
                          4-eyes
                        </Badge>
                      )}
                    </div>

                    {rule.description && (
                      <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>
                    )}

                    {/* Approvers */}
                    <div className="flex flex-wrap gap-1.5">
                      {namedApprovers.length > 0 ? (
                        <>
                          <span className="text-[10px] text-muted-foreground self-center">Named:</span>
                          {namedApprovers.map((name, i) => (
                            <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/8 border border-primary/20 text-[10px] font-medium text-primary">
                              <Users className="h-2.5 w-2.5" />{name}
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-muted-foreground self-center">Roles:</span>
                          {rule.allowed_roles.map(role => {
                            const cfg = ROLE_CFG[role];
                            return (
                              <div key={role} className={cn(
                                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                                role === 'owner'
                                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                                  : 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400'
                              )}>
                                {cfg?.icon}{cfg?.label ?? role}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canEdit && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        aria-label="Edit rule"
                        onClick={() => openEdit(rule)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label="Delete rule"
                        onClick={() => setDeleteTarget(rule)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approvers directory */}
      {approverOptions.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Current Approvers on Team
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {approverOptions.map(m => {
              const cfg = ROLE_CFG[m.role];
              return (
                <div key={m.user_id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {(m.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{m.full_name || 'Unknown'}</p>
                    <p className={cn('text-[10px] flex items-center gap-0.5', cfg?.color)}>
                      {cfg?.icon}{cfg?.label ?? m.role}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rule form dialog */}
      <RuleForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        existing={editTarget}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This rule will be permanently removed. POs in the {deleteTarget?.min_amount.toFixed(0)} –{' '}
              {deleteTarget?.max_amount != null ? `${deleteTarget.max_amount.toFixed(0)} KWD` : 'unlimited'} range
              will fall back to the next matching rule or default behaviour.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteRule.mutate(deleteTarget!.id); setDeleteTarget(null); }}>
              Delete Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
