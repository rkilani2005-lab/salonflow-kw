import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { EmptyState, LoadingState } from '@/components/ui/state-primitives';
import {
  Users, UserPlus, Mail, Shield, Crown, Clock, CheckCircle2,
  XCircle, MoreHorizontal, Loader2, AlertTriangle, RefreshCw,
  Trash2, Lock, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

// ── Plan limits ───────────────────────────────────────────────
const PLAN_LIMITS: Record<string, number> = {
  starter:      3,
  professional: 10,
  ai:           9999,
};

const PLAN_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  starter:      { en: 'Starter',      ar: 'المبتدئ',   color: 'text-muted-foreground' },
  professional: { en: 'Professional', ar: 'المحترف',   color: 'text-primary' },
  ai:           { en: 'AI Premium',   ar: 'AI الأقصى', color: 'text-amber-600' },
};

// ── Role config ──────────────────────────────────────────────
const ROLES = [
  { value: 'manager',        en: 'Manager',         ar: 'مديرة',          desc: 'Full access except billing', color: 'text-violet-600' },
  { value: 'receptionist',   en: 'Receptionist',    ar: 'موظفة استقبال',  desc: 'Calendar, POS, clients',    color: 'text-blue-600' },
  { value: 'cashier',        en: 'Cashier',         ar: 'كاشيرة',         desc: 'POS and day session only',  color: 'text-emerald-600' },
  { value: 'stylist',        en: 'Stylist',         ar: 'مصففة',          desc: 'Calendar and own bookings', color: 'text-pink-600' },
  { value: 'inventory_clerk',en: 'Inventory Clerk', ar: 'موظفة مخزون',    desc: 'Inventory module only',     color: 'text-amber-600' },
  { value: 'accountant',     en: 'Accountant',      ar: 'محاسبة',          desc: 'Finance and reports only',  color: 'text-indigo-600' },
  { value: 'readonly',       en: 'Read-only',       ar: 'قراءة فقط',       desc: 'View everything, edit nothing', color: 'text-muted-foreground' },
];

interface TeamMember {
  user_id:    string;
  role:       string;
  created_at: string;
  profile?: {
    full_name: string | null;
    phone:     string | null;
  };
}

interface Invitation {
  id:         string;
  email:      string;
  role:       string;
  status:     string;
  created_at: string;
  expires_at: string;
}

// ── Hooks ────────────────────────────────────────────────────

function useTeamMembers() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['team-members', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      // Get all user_roles for this tenant (excluding owner since they're the account holder)
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at')
        .eq('tenant_id', tenant.id)
        .neq('role', 'super_admin')
        .order('created_at');
      if (error) throw error;

      // Fetch profiles for each user
      const userIds = (roles || []).map(r => r.user_id);
      let profiles: Record<string, { full_name: string | null; phone: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', userIds);
        for (const p of profileData || []) {
          profiles[p.user_id] = { full_name: p.full_name, phone: p.phone };
        }
      }

      return (roles || []).map(r => ({
        ...r,
        profile: profiles[r.user_id] || null,
      })) as TeamMember[];
    },
    enabled: !!tenant?.id,
  });
}

function useInvitations() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['team-invitations', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await (supabase as any)
        .from('tenant_invitations')
        .select('id, email, role, status, created_at, expires_at')
        .eq('tenant_id', tenant.id)
        .neq('status', 'accepted')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Invitation[];
    },
    enabled: !!tenant?.id,
  });
}

// ── Main component ───────────────────────────────────────────

export default function TeamUsers() {
  const { tenant, profile, userRoles } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const ar = language === 'ar';

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState('receptionist');
  const [inviting,    setInviting]    = useState(false);
  const [revoking,    setRevoking]    = useState<string | null>(null);
  const [changeRole,  setChangeRole]  = useState<{ userId: string; current: string } | null>(null);

  const { data: members  = [], isLoading: loadingMembers } = useTeamMembers();
  const { data: invites  = [], isLoading: loadingInvites } = useInvitations();

  const plan        = (tenant?.subscription_plan || 'starter') as string;
  const limit       = PLAN_LIMITS[plan] ?? 3;
  const usedSlots   = members.length;
  const canInvite   = usedSlots < limit;
  const isOwner     = userRoles.includes('owner');
  const isManager   = userRoles.includes('manager');
  const canManage   = isOwner || isManager;

  const pctUsed     = limit >= 9999 ? 0 : Math.min(100, Math.round((usedSlots / limit) * 100));

  // ── Invite ──────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !tenant?.id) return;
    if (!canInvite) {
      toast({ title: ar ? 'تجاوزت الحد المسموح' : 'User limit reached', description: ar ? 'قومي بترقية الخطة لإضافة المزيد' : 'Upgrade your plan to add more users', variant: 'destructive' });
      return;
    }
    setInviting(true);
    try {
      const res = await supabase.functions.invoke('invite-user', {
        body: {
          tenant_id:        tenant.id,
          email:            inviteEmail.trim().toLowerCase(),
          role:             inviteRole,
          invited_by_name:  profile?.full_name || 'Salon Owner',
          salon_name:       tenant.name,
        },
      });

      if (res.error || res.data?.error) {
        const msg = res.data?.error || res.error?.message || 'Unknown error';
        if (res.data?.limit_reached) {
          toast({ title: ar ? 'تجاوزت الحد' : 'Plan limit reached', description: msg, variant: 'destructive' });
        } else {
          toast({ title: ar ? 'فشل الإرسال' : 'Invite failed', description: msg, variant: 'destructive' });
        }
        return;
      }

      toast({ title: ar ? `✅ تم الإرسال` : `✅ Invite sent`, description: ar ? `تم إرسال دعوة إلى ${inviteEmail}` : `Invitation sent to ${inviteEmail}` });
      setInviteEmail('');
      setInviteRole('receptionist');
      setInviteOpen(false);
      qc.invalidateQueries({ queryKey: ['team-invitations', tenant.id] });
    } catch (err: any) {
      toast({ title: ar ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  // ── Revoke invitation ────────────────────────────────────────
  const handleRevokeInvite = async (inviteId: string) => {
    setRevoking(inviteId);
    await (supabase as any).from('tenant_invitations').update({ status: 'revoked' }).eq('id', inviteId);
    qc.invalidateQueries({ queryKey: ['team-invitations', tenant?.id] });
    setRevoking(null);
    toast({ title: ar ? 'تم سحب الدعوة' : 'Invitation revoked' });
  };

  // ── Revoke user access ───────────────────────────────────────
  const handleRevokeAccess = async (userId: string) => {
    if (!tenant?.id) return;
    setRevoking(userId);
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('tenant_id', tenant.id);
    await supabase.from('profiles').update({ tenant_id: null }).eq('user_id', userId);
    qc.invalidateQueries({ queryKey: ['team-members', tenant.id] });
    setRevoking(null);
    toast({ title: ar ? 'تم سحب الصلاحية' : 'Access revoked' });
  };

  // ── Change role ───────────────────────────────────────────────
  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!tenant?.id) return;
    await (supabase as any).from('user_roles').update({ role: newRole as any }).eq('user_id', userId).eq('tenant_id', tenant.id);
    qc.invalidateQueries({ queryKey: ['team-members', tenant.id] });
    setChangeRole(null);
    toast({ title: ar ? 'تم تحديث الدور' : 'Role updated' });
  };

  const getRoleConfig = (role: string) => ROLES.find(r => r.value === role) || ROLES[0];

  const pendingInvites = invites.filter(i => i.status === 'pending' && new Date(i.expires_at) > new Date());
  const expiredInvites = invites.filter(i => i.status === 'expired' || new Date(i.expires_at) <= new Date());

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" dir={ar ? 'rtl' : 'ltr'}>
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {ar ? 'الفريق' : 'Team'}
          </p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.04em' }}>
            {ar ? 'إدارة المستخدمين' : 'Team Members'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ar
              ? 'إدارة الأشخاص الذين يمكنهم الدخول لنظام ZAINA'
              : 'Manage who can access your ZAINA portal'}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)} disabled={!canInvite} size="sm" className="gap-1.5 h-9">
            <UserPlus className="h-3.5 w-3.5" />
            {ar ? 'دعوة مستخدم' : 'Invite User'}
          </Button>
        )}
      </div>

      {/* ── Plan usage bar ── */}
      <div className="border rounded-md bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {ar ? 'استخدام المستخدمين' : 'User Seats'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {ar ? `خطة ${PLAN_LABELS[plan]?.ar}` : `${PLAN_LABELS[plan]?.en} plan`}
            </span>
            <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 rounded-sm font-bold border', PLAN_LABELS[plan]?.color)}>
              {limit >= 9999 ? (ar ? 'غير محدود' : 'Unlimited') : `${usedSlots} / ${limit}`}
            </Badge>
          </div>
        </div>
        {limit < 9999 && (
          <>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', pctUsed >= 100 ? 'bg-destructive' : pctUsed >= 80 ? 'bg-amber-500' : 'bg-primary')}
                style={{ width: `${pctUsed}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[11px] text-muted-foreground">
                {limit - usedSlots > 0
                  ? (ar ? `${limit - usedSlots} مقاعد متاحة` : `${limit - usedSlots} seats remaining`)
                  : (ar ? 'وصلتِ للحد الأقصى' : 'Limit reached')}
              </span>
              {!canInvite && (
                <button
                  onClick={() => window.location.href = '/subscription'}
                  className="text-[11px] text-primary font-semibold hover:underline"
                >
                  {ar ? 'ترقية الخطة ←' : '→ Upgrade plan'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Active members ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.07em] text-muted-foreground/60 select-none">
          {ar ? `الأعضاء النشطون (${members.length})` : `Active Members (${members.length})`}
        </h2>

        {loadingMembers ? (
          <LoadingState variant="rows" rows={3} />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            size="compact"
            title={ar ? 'لا يوجد أعضاء فريق بعد' : 'No team members yet'}
            description={ar ? 'قومي بدعوة أول عضو في فريقك' : 'Invite your first team member above.'}
          />
        ) : (
          <div className="border rounded-md overflow-hidden divide-y divide-border">
            {members.map(member => {
              const rc = getRoleConfig(member.role);
              const isCurrentUser = member.user_id === profile?.user_id;
              const isOwnerRow = member.role === 'owner';

              return (
                <div key={member.user_id} className="flex items-center gap-4 px-4 py-3.5 bg-card hover:bg-muted/20 transition-colors">
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-black text-primary">
                      {(member.profile?.full_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">
                        {member.profile?.full_name || (ar ? 'مستخدم' : 'User')}
                      </span>
                      {isCurrentUser && (
                        <Badge className="text-[9px] h-4 px-1.5 rounded-sm font-bold bg-muted text-muted-foreground border border-border">
                          {ar ? 'أنتِ' : 'You'}
                        </Badge>
                      )}
                      {isOwnerRow && (
                        <Crown className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </div>
                    {member.profile?.phone && (
                      <p className="text-[11px] text-muted-foreground">{member.profile.phone}</p>
                    )}
                  </div>

                  {/* Role badge */}
                  <div className="flex-shrink-0">
                    {canManage && !isCurrentUser && !isOwnerRow ? (
                      <Select
                        value={member.role}
                        onValueChange={val => handleChangeRole(member.user_id, val)}
                      >
                        <SelectTrigger className="h-7 text-[11px] font-semibold border-border w-36 rounded-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => (
                            <SelectItem key={r.value} value={r.value} className="text-xs">
                              <span className={r.color}>{ar ? r.ar : r.en}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={cn('text-[10px] h-6 px-2 rounded-sm font-semibold border', rc.color)}>
                        {ar ? rc.ar : rc.en}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  {canManage && !isCurrentUser && !isOwnerRow && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/8 flex-shrink-0"
                      onClick={() => handleRevokeAccess(member.user_id)}
                      disabled={revoking === member.user_id}
                      title={ar ? 'سحب الصلاحية' : 'Revoke access'}
                    >
                      {revoking === member.user_id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <XCircle className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pending invitations ── */}
      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.07em] text-muted-foreground/60 select-none">
            {ar ? `دعوات معلقة (${pendingInvites.length})` : `Pending Invitations (${pendingInvites.length})`}
          </h2>
          <div className="border rounded-md overflow-hidden divide-y divide-border">
            {pendingInvites.map(inv => {
              const rc = getRoleConfig(inv.role);
              const expiresIn = formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true });
              return (
                <div key={inv.id} className="flex items-center gap-4 px-4 py-3.5 bg-amber-50/50 dark:bg-amber-950/10">
                  <div className="h-9 w-9 rounded-sm bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{inv.email}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ar ? `تنتهي ${expiresIn}` : `Expires ${expiresIn}`}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('text-[10px] h-6 px-2 rounded-sm font-semibold border flex-shrink-0', rc.color)}>
                    {ar ? rc.ar : rc.en}
                  </Badge>
                  <Badge className="text-[9px] h-5 px-1.5 rounded-sm font-bold bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400 flex-shrink-0">
                    {ar ? 'معلق' : 'Pending'}
                  </Badge>
                  {canManage && (
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/8 flex-shrink-0"
                      onClick={() => handleRevokeInvite(inv.id)}
                      disabled={revoking === inv.id}
                      title={ar ? 'سحب الدعوة' : 'Revoke invitation'}
                    >
                      {revoking === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Role reference card ── */}
      <div className="border rounded-md bg-card p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.07em] text-muted-foreground/60 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          {ar ? 'صلاحيات الأدوار' : 'Role Permissions'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-start gap-2.5">
              <div className={cn('text-[10px] font-bold mt-0.5 w-24 flex-shrink-0', r.color)}>
                {ar ? r.ar : r.en}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Invite dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="h-7 w-7 rounded-sm bg-primary/10 flex items-center justify-center">
                <UserPlus className="h-3.5 w-3.5 text-primary" />
              </div>
              {ar ? 'دعوة مستخدم جديد' : 'Invite Team Member'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Limit warning */}
            {!canInvite && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/8 border border-destructive/20 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {ar ? `وصلتِ للحد الأقصى (${limit} مستخدمين) لخطة ${PLAN_LABELS[plan]?.ar}. قومي بترقية خطتك.` : `You've reached the ${limit}-user limit on your ${PLAN_LABELS[plan]?.en} plan. Upgrade to add more.`}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? 'البريد الإلكتروني *' : 'Email Address *'}
              </Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@email.com"
                className="h-10"
                autoFocus
                dir="ltr"
              />
              <p className="text-[11px] text-muted-foreground">
                {ar ? 'سيصلهم بريد إلكتروني لإنشاء كلمة المرور والوصول للنظام' : "They'll receive an email to set their password and access the portal"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'الدور *' : 'Role *'}</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span className={cn('font-semibold text-sm', r.color)}>{ar ? r.ar : r.en}</span>
                        <span className="text-xs text-muted-foreground">{r.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seats summary */}
            {limit < 9999 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground p-2.5 rounded-md bg-muted/40">
                <span>{ar ? 'المقاعد المستخدمة' : 'Seats used'}</span>
                <span className="font-semibold">{usedSlots + 1} / {limit} {ar ? 'بعد الدعوة' : 'after this invite'}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setInviteOpen(false)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim() || !canInvite}
              className="gap-1.5 min-w-[110px]"
            >
              {inviting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Mail className="h-3.5 w-3.5" />}
              {inviting ? (ar ? 'جارٍ الإرسال...' : 'Sending...') : (ar ? 'إرسال الدعوة' : 'Send Invite')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
