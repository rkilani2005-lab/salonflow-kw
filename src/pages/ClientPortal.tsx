import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Star, Calendar, Clock, Scissors, Package, Crown,
  ChevronRight, Gift, TrendingUp, CheckCircle2, Home,
  AlertCircle, XCircle, Sparkles, History, Phone, User,
  Mail, Tag, ArrowRight, Zap,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────
interface PortalData {
  client: {
    id: string; name: string; email: string | null; phone: string;
    loyaltyPoints: number; tier: string; created_at: string;
  };
  upcoming: any[];
  history:  any[];
  packages: any[];
  loyaltyLog: any[];
  tenant: { id: string; name: string; logo_url: string | null };
}

// ─── Status config ────────────────────────────────────────────
const STATUS_CFG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  completed:  { icon: <CheckCircle2 className="h-4 w-4"/>, label: 'Completed',  color: 'text-emerald-500' },
  confirmed:  { icon: <CheckCircle2 className="h-4 w-4"/>, label: 'Confirmed',  color: 'text-blue-400'    },
  planned:    { icon: <Clock        className="h-4 w-4"/>, label: 'Scheduled',  color: 'text-amber-500'   },
  in_service: { icon: <Scissors     className="h-4 w-4"/>, label: 'In Service', color: 'text-violet-500'  },
  cancelled:  { icon: <XCircle      className="h-4 w-4"/>, label: 'Cancelled',  color: 'text-red-400'     },
  no_show:    { icon: <XCircle      className="h-4 w-4"/>, label: 'No Show',    color: 'text-red-400'     },
};

const TIER_CFG: Record<string, { label: string; color: string; bg: string }> = {
  normal: { label: 'Client', color: 'text-muted-foreground', bg: '' },
  vip:    { label: 'VIP ⭐', color: 'text-amber-600',        bg: 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' },
  vvip:   { label: 'VVIP 👑', color: 'text-primary',         bg: 'bg-primary/5 border border-primary/20' },
};

type View = 'home' | 'upcoming' | 'history' | 'points' | 'packages';

const NAV_ITEMS = [
  { id: 'home'     as View, icon: Home,     label: 'Home'     },
  { id: 'upcoming' as View, icon: Calendar, label: 'Bookings' },
  { id: 'history'  as View, icon: History,  label: 'History'  },
  { id: 'points'   as View, icon: Star,     label: 'Points'   },
  { id: 'packages' as View, icon: Package,  label: 'Packages' },
];

// ─── Main portal ──────────────────────────────────────────────
export default function ClientPortal() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant');
  const token    = searchParams.get('token');

  const [data,    setData]    = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [view,    setView]    = useState<View>('home');

  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName,  setEditName]  = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [relinkPhone, setRelinkPhone] = useState('');
  const [relinkBusy,  setRelinkBusy]  = useState(false);
  const [relinkSent,  setRelinkSent]  = useState(false);

  useEffect(() => {
    if (!tenantId || !token) { setError('Invalid portal link'); setLoading(false); return; }
    load();
  }, [tenantId, token]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('create-public-booking', {
        body: { action: 'get-portal', tenantId, portalToken: token },
      });
      if (err || res?.error) throw new Error(res?.error || 'Failed to load portal');
      setData(res);
      setEditName(res.client.name);
      setEditEmail(res.client.email || '');
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const handleSaveProfile = async () => {
    if (!data || !editName.trim()) return;
    setSavingProfile(true);
    try {
      await supabase.from('clients')
        .update({ name: editName.trim(), email: editEmail.trim() || null })
        .eq('id', data.client.id);
      setData(prev => prev ? { ...prev, client: { ...prev.client, name: editName.trim(), email: editEmail.trim() || null } } : prev);
      setEditingProfile(false);
    } catch { /* fail silently */ }
    finally { setSavingProfile(false); }
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="bg-primary px-6 pt-12 pb-8">
        <Skeleton className="h-14 w-14 rounded-2xl mb-4 bg-white/20"/>
        <Skeleton className="h-6 w-40 mb-2 bg-white/20"/>
        <Skeleton className="h-4 w-28 bg-white/20"/>
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl bg-white/20"/>)}
        </div>
      </div>
      <div className="px-5 py-5 space-y-3">
        {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-2xl"/>)}
      </div>
    </div>
  );

  // ── Error ──────────────────────────────────────────────────
  if (error || !data) return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center px-6">
      <div className="text-center max-w-sm w-full bg-background rounded-2xl border border-border/60 p-8 md:shadow-xl">
        <div className="h-16 w-16 rounded-2xl bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
          <XCircle className="h-8 w-8 text-red-500"/>
        </div>
        <h2 className="text-xl font-bold mb-2">Portal Unavailable</h2>
        <p className="text-muted-foreground text-sm mb-6">{error || 'This link may have expired or is invalid.'}</p>

        {/* Re-access: request a fresh link on WhatsApp */}
        {tenantId && (
          <div className="text-left bg-muted/40 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold mb-1">Lost your link?</p>
            <p className="text-xs text-muted-foreground mb-3">Enter your phone number and we'll send a fresh portal link to your WhatsApp.</p>
            {relinkSent ? (
              <p className="text-xs text-emerald-600 font-medium">If your number is registered, you'll receive a link on WhatsApp shortly. ✅</p>
            ) : (
              <div className="flex gap-2">
                <input
                  value={relinkPhone}
                  onChange={e => setRelinkPhone(e.target.value)}
                  placeholder="+965 …"
                  inputMode="tel"
                  className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm"/>
                <Button size="sm" disabled={relinkBusy || relinkPhone.replace(/\D/g,'').length < 7}
                  onClick={async () => {
                    setRelinkBusy(true);
                    try {
                      await supabase.functions.invoke('create-public-booking', {
                        body: { action: 'request-portal-link', tenantId, clientPhone: relinkPhone.trim() },
                      });
                      setRelinkSent(true);
                    } catch { setRelinkSent(true); /* generic regardless */ }
                    finally { setRelinkBusy(false); }
                  }}>
                  {relinkBusy ? '…' : 'Send'}
                </Button>
              </div>
            )}
          </div>
        )}

        {tenantId && (
          <Link to={`/book?tenant=${tenantId}`}>
            <Button variant="outline" className="gap-2"><Calendar className="h-4 w-4"/>Book an Appointment</Button>
          </Link>
        )}
      </div>
    </div>
  );

  const { client, upcoming, history, packages, loyaltyLog, tenant } = data;
  const tier = TIER_CFG[client.tier] || TIER_CFG.normal;
  const totalSpent = history.reduce((s: number, b: any) => s + Number(b.price), 0);
  const activePackages = packages.filter((p: any) => p.status === 'active');
  // KWD value of points (assuming 0.01 KWD per point — should ideally come from loyalty_config)
  const pointsValue = (client.loyaltyPoints * 0.01).toFixed(3);

  return (
    <div className="min-h-screen bg-muted/40 flex justify-center">
    <div className="min-h-screen bg-background w-full max-w-md mx-auto flex flex-col relative md:shadow-xl md:border-x border-border/60">

      {/* ── Primary header (always visible) ── */}
      <div className="bg-primary text-primary-foreground px-5 pt-10 pb-6 relative overflow-hidden flex-shrink-0">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none"/>
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4 pointer-events-none"/>

        {/* Salon name */}
        <p className="text-primary-foreground/60 text-xs font-semibold mb-3 relative z-10">{tenant.name}</p>

        {/* Client identity */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-black flex-shrink-0">
            {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold truncate">{client.name}</h1>
              {client.tier !== 'normal' && (
                <span className="text-xs font-bold text-amber-300">{tier.label}</span>
              )}
            </div>
            <p className="text-primary-foreground/70 text-xs mt-0.5 flex items-center gap-1.5">
              <Phone className="h-3 w-3"/>{client.phone}
              {client.email && <><span className="opacity-40">·</span><Mail className="h-3 w-3"/><span className="truncate">{client.email}</span></>}
            </p>
          </div>
          <button
            onClick={() => { setEditingProfile(!editingProfile); setView('home'); }}
            className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors flex-shrink-0">
            <User className="h-4 w-4"/>
          </button>
        </div>

        {/* Stats row — always visible */}
        <div className="grid grid-cols-3 gap-2 mt-5 relative z-10">
          {[
            { emoji: '📋', val: history.length,              label: 'Visits',  onClick: () => setView('history')  },
            { emoji: '💳', val: totalSpent.toFixed(0),       label: 'KWD',     onClick: () => setView('history')  },
            { emoji: '⭐', val: client.loyaltyPoints,        label: 'Points',  onClick: () => setView('points')   },
          ].map(({ emoji, val, label, onClick }) => (
            <button key={label} onClick={onClick}
              className="bg-white/10 hover:bg-white/20 transition-colors rounded-xl p-3 text-center">
              <p className="text-lg">{emoji}</p>
              <p className="text-base font-black stat-number">{val}</p>
              <p className="text-[10px] text-primary-foreground/60">{label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Profile edit panel (inline) ── */}
      {editingProfile && (
        <div className="bg-card border-b px-5 py-4 space-y-3">
          <p className="text-sm font-semibold">Edit Profile</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Full Name</Label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-9"/>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-9" placeholder="Optional"/>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile} className="flex-1">
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingProfile(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Scrollable content area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-24 space-y-4">

        {/* ════════════════ HOME VIEW ════════════════ */}
        {view === 'home' && (
          <>
            {/* Next appointment highlight */}
            {upcoming.length > 0 && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mb-2">
                  🗓 Next Appointment
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{upcoming[0].service_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(upcoming[0].booking_date), 'EEEE, MMM d')}
                      {' at '}{upcoming[0].start_time?.slice(0, 5)}
                    </p>
                  </div>
                  <div className={cn('flex items-center gap-1', STATUS_CFG[upcoming[0].status]?.color)}>
                    {STATUS_CFG[upcoming[0].status]?.icon}
                    <span className="text-xs capitalize">{STATUS_CFG[upcoming[0].status]?.label}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Loyalty points highlight */}
            {client.loyaltyPoints > 0 && (
              <button onClick={() => setView('points')}
                className="w-full rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 text-left hover:border-amber-400 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                      <Star className="h-5 w-5 text-amber-500 fill-amber-400"/>
                    </div>
                    <div>
                      <p className="font-bold text-amber-700 dark:text-amber-300 stat-number">
                        {client.loyaltyPoints} points
                      </p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/70">
                        ≈ {pointsValue} KWD redeemable at checkout
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-amber-500"/>
                </div>
              </button>
            )}

            {/* Active packages */}
            {activePackages.length > 0 && (
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    🎁 Active Packages
                  </p>
                  <button onClick={() => setView('packages')}
                    className="text-[10px] text-emerald-600 flex items-center gap-0.5 hover:text-emerald-800">
                    View all <ChevronRight className="h-3 w-3"/>
                  </button>
                </div>
                {activePackages.slice(0, 2).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between mb-2 last:mb-0">
                    <p className="text-sm font-medium">{p.package?.name}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-emerald-200 dark:bg-emerald-900 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.round((p.sessions_used / p.sessions_total) * 100)}%` }}/>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {p.sessions_remaining}/{p.sessions_total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Offers & promos teaser */}
            <div className="rounded-2xl border bg-gradient-to-r from-primary/5 to-amber-500/5 border-primary/15 p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Tag className="h-5 w-5 text-primary"/>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Exclusive Member Offers</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ask the salon for current promos and multi-session packages available to you.
                  </p>
                </div>
                <Sparkles className="h-4 w-4 text-amber-400 flex-shrink-0 mt-1"/>
              </div>
            </div>

            {/* Nav menu */}
            <div className="space-y-2">
              {[
                { id: 'upcoming' as View, icon: Calendar, label: 'Upcoming Appointments', sub: `${upcoming.length} scheduled`,    color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
                { id: 'history'  as View, icon: History,  label: 'Visit History',          sub: `${history.length} total visits`,  color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-950/30' },
                { id: 'points'   as View, icon: Star,     label: 'Loyalty Points',         sub: `${client.loyaltyPoints} pts · ${pointsValue} KWD`, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
                { id: 'packages' as View, icon: Package,  label: 'My Packages',            sub: `${activePackages.length} active`,  color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
              ].map(item => (
                <button key={item.id} onClick={() => setView(item.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border bg-card hover:border-primary/30 hover:bg-primary/3 transition-all text-left">
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', item.bg)}>
                    <item.icon className={cn('h-5 w-5', item.color)}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0"/>
                </button>
              ))}
            </div>

            {/* Book again */}
            <Link to={`/book?tenant=${tenant.id}`}>
              <Button className="w-full h-12 gap-2 text-base font-semibold">
                <Calendar className="h-4 w-4"/>Book an Appointment
              </Button>
            </Link>
          </>
        )}

        {/* ════════════════ UPCOMING BOOKINGS ════════════════ */}
        {view === 'upcoming' && (
          <div className="space-y-3">
            {upcoming.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-25"/>
                <p className="font-semibold text-sm">No upcoming appointments</p>
                <p className="text-xs mt-1 mb-5">Ready to book your next visit?</p>
                <Link to={`/book?tenant=${tenant.id}`}>
                  <Button size="sm" className="gap-2"><Calendar className="h-3.5 w-3.5"/>Book Now</Button>
                </Link>
              </div>
            ) : upcoming.map((b: any) => (
              <div key={b.id} className="border rounded-2xl p-4 bg-card">
                <div className="flex items-start justify-between mb-3">
                  <p className="font-semibold text-sm">{b.service_name}</p>
                  <div className={cn('flex items-center gap-1 text-xs capitalize', STATUS_CFG[b.status]?.color || 'text-muted-foreground')}>
                    {STATUS_CFG[b.status]?.icon}
                    {STATUS_CFG[b.status]?.label || b.status}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5"/>
                    {format(parseISO(b.booking_date), 'EEE, MMM d, yyyy')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5"/>
                    {b.start_time?.slice(0, 5)}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(b.booking_date), { addSuffix: true })}
                  </p>
                  <p className="text-xs font-bold stat-number">{Number(b.price).toFixed(3)} KWD</p>
                </div>
              </div>
            ))}

            <Link to={`/book?tenant=${tenant.id}`}>
              <Button variant="outline" className="w-full gap-2">
                <Calendar className="h-4 w-4"/>Book Another Appointment
              </Button>
            </Link>
          </div>
        )}

        {/* ════════════════ VISIT HISTORY ════════════════ */}
        {view === 'history' && (
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-25"/>
                <p className="font-semibold text-sm">No visits yet</p>
                <p className="text-xs mt-1">Your visit history will appear here</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <div className="p-4 rounded-2xl bg-muted/40 text-center">
                    <p className="text-2xl font-black stat-number text-primary">{history.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Visits</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/40 text-center">
                    <p className="text-2xl font-black stat-number text-emerald-600">{totalSpent.toFixed(3)}</p>
                    <p className="text-xs text-muted-foreground mt-1">KWD Spent</p>
                  </div>
                </div>

                {/* Visit list */}
                {history.map((b: any) => (
                  <div key={b.id} className="border rounded-2xl p-4 bg-card">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <Scissors className="h-5 w-5 text-muted-foreground"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{b.service_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(b.booking_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <p className="font-bold text-sm stat-number flex-shrink-0">{Number(b.price).toFixed(3)}</p>
                    </div>
                  </div>
                ))}

                {/* Book again CTA */}
                <Link to={`/book?tenant=${tenant.id}`}>
                  <Button variant="outline" className="w-full gap-2 mt-2">
                    <Calendar className="h-4 w-4"/>Book Your Next Visit
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}

        {/* ════════════════ LOYALTY POINTS ════════════════ */}
        {view === 'points' && (
          <div className="space-y-4">
            {/* Balance card */}
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-amber-200/30 dark:bg-amber-800/20 -translate-y-1/3 translate-x-1/3"/>
              <Star className="h-10 w-10 text-amber-400 fill-amber-400 mx-auto mb-3 relative z-10"/>
              <p className="text-5xl font-black stat-number text-amber-700 dark:text-amber-300 relative z-10">
                {client.loyaltyPoints}
              </p>
              <p className="text-sm text-amber-600/80 dark:text-amber-400/70 mt-1 relative z-10">loyalty points</p>
              {client.loyaltyPoints > 0 && (
                <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl relative z-10">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    ≈ {pointsValue} KWD redeemable value
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                    Redeem at checkout on your next visit
                  </p>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">How It Works</p>
              {[
                { icon: '💳', title: 'Earn on every visit', desc: 'Points are added automatically after each service' },
                { icon: '⭐', title: 'Redeem for discounts', desc: 'Use points to reduce your next bill at checkout' },
                { icon: '🎁', title: 'VIP benefits', desc: 'More visits unlock VIP and VVIP status with extra perks' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{icon}</span>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent activity */}
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent Activity</p>
            {loyaltyLog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>No activity yet</p>
                <p className="text-xs mt-1 opacity-70">Points are earned automatically on every visit</p>
              </div>
            ) : loyaltyLog.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl border bg-card">
                <div>
                  <p className="text-sm font-medium capitalize">{t.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    {t.note ? ` · ${t.note}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('font-black stat-number text-base', t.points > 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {t.points > 0 ? '+' : ''}{t.points}
                  </p>
                  <p className="text-[10px] text-muted-foreground">bal: {t.balance_after}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════════════════ PACKAGES ════════════════ */}
        {view === 'packages' && (
          <div className="space-y-3">
            {packages.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Gift className="h-12 w-12 mx-auto mb-3 opacity-25"/>
                <p className="font-semibold text-sm">No packages yet</p>
                <p className="text-xs mt-1 max-w-[220px] mx-auto">
                  Ask the salon about multi-session bundles — buy 5 sessions and save!
                </p>
              </div>
            ) : (
              <>
                {/* Active packages first */}
                {activePackages.length > 0 && (
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active</p>
                )}
                {packages.map((p: any) => {
                  const pct = p.sessions_total > 0
                    ? Math.round((p.sessions_used / p.sessions_total) * 100)
                    : 0;
                  const isActive = p.status === 'active';
                  return (
                    <div key={p.id} className={cn('border rounded-2xl p-4 bg-card', !isActive && 'opacity-60')}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${p.package?.color || '#C0395E'}20` }}>
                            <Package className="h-4.5 w-4.5" style={{ color: p.package?.color || '#C0395E' }}/>
                          </div>
                          <p className="font-semibold text-sm">{p.package?.name}</p>
                        </div>
                        <Badge variant="outline" className={cn(
                          'text-[9px] h-4 px-1.5 capitalize border',
                          isActive ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' : 'border-border text-muted-foreground'
                        )}>
                          {p.status}
                        </Badge>
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}/>
                        </div>
                        <span className="text-sm font-black stat-number">{p.sessions_remaining}/{p.sessions_total}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground">
                          {p.sessions_remaining} session{p.sessions_remaining !== 1 ? 's' : ''} remaining
                        </p>
                        {p.expires_at && (
                          <p className="text-[10px] text-muted-foreground">
                            expires {format(parseISO(p.expires_at), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom navigation bar (fixed) ── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 py-2 z-30">
        {NAV_ITEMS.map(item => {
          const isActive = view === item.id;
          const badge =
            item.id === 'upcoming' ? upcoming.length :
            item.id === 'packages' ? activePackages.length : 0;
          return (
            <button key={item.id} onClick={() => setView(item.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}>
              <div className="relative">
                <item.icon className={cn('h-5 w-5', isActive && 'fill-primary/20')}/>
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-3.5 w-3.5 rounded-full bg-primary text-[8px] text-primary-foreground font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary"/>}
            </button>
          );
        })}
      </nav>
    </div>
    </div>
  );
}
