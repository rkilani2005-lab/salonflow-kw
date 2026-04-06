import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Star, Calendar, Gift, Scissors, Phone, Loader2,
  CheckCircle2, Clock, TrendingUp, Package, ChevronRight,
  MessageSquare, Crown,
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface ClientData {
  id: string; name: string; phone: string; email: string|null;
  tier: string; loyalty_points: number; created_at: string;
}
interface Booking {
  id:string; service_name:string; booking_date:string; start_time:string;
  status:string; price:number; staff_id:string|null;
}
interface ClientPkg {
  id:string; sessions_total:number; sessions_used:number; sessions_remaining:number;
  expires_at:string|null; status:string; purchase_date:string;
  package:{ name:string; color:string };
}
interface LoyaltyTx {
  id:string; type:string; points:number; balance_after:number; note:string|null; created_at:string;
}

const STATUS_COLOR: Record<string,string> = {
  confirmed:  'text-emerald-600',
  completed:  'text-muted-foreground',
  cancelled:  'text-red-400',
  planned:    'text-blue-500',
  in_service: 'text-violet-600',
};

const TIER_CFG: Record<string,{label:string;icon:React.ReactNode;color:string}> = {
  normal: { label:'Client',   icon:null,                                      color:'text-muted-foreground' },
  vip:    { label:'VIP',      icon:<Star className="h-4 w-4 text-amber-400"/>, color:'text-amber-600' },
  vvip:   { label:'VVIP',     icon:<Crown className="h-4 w-4 text-amber-500"/>,color:'text-amber-500' },
};

export default function ClientPortal() {
  const [searchParams] = useSearchParams();
  const initPhone  = searchParams.get('phone') || '';
  const tenantId   = searchParams.get('tenant') || '';

  const [phase, setPhase] = useState<'phone'|'loading'|'portal'>('phone');
  const [phone,  setPhone]  = useState(initPhone);
  const [otp,    setOtp]    = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error,  setError]  = useState('');
  const [sending, setSending] = useState(false);

  const [client,   setClient]   = useState<ClientData|null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [packages, setPackages] = useState<ClientPkg[]>([]);
  const [loyaltyTx,setLoyaltyTx]= useState<LoyaltyTx[]>([]);
  const [tenantName, setTenantName] = useState('');

  // If phone passed in URL (from post-booking CTA), skip to OTP step
  useEffect(() => { if (initPhone) setOtpSent(false); }, []);

  const sendOtp = async () => {
    const clean = phone.replace(/\s/g,'');
    if (!clean || clean.length < 8) { setError('Enter a valid phone number'); return; }
    setSending(true); setError('');
    try {
      // Use Supabase phone OTP
      const { error } = await supabase.auth.signInWithOtp({ phone: clean.startsWith('+') ? clean : `+965${clean}` });
      if (error) throw error;
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally { setSending(false); }
  };

  const verifyOtp = async () => {
    const clean = phone.replace(/\s/g,'');
    setSending(true); setError('');
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        phone: clean.startsWith('+') ? clean : `+965${clean}`,
        token: otp,
        type: 'sms',
      });
      if (verifyErr) throw verifyErr;
      await loadPortal(clean);
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally { setSending(false); }
  };

  // Skip OTP in demo — look up client directly by phone+tenant
  const skipOtpLookup = async () => {
    setSending(true); setError('');
    try {
      await loadPortal(phone.replace(/\s/g,''));
    } catch (err: any) {
      setError('No account found for this number');
    } finally { setSending(false); }
  };

  const loadPortal = async (cleanPhone: string) => {
    setPhase('loading');

    // Get tenant name
    if (tenantId) {
      const { data: t } = await supabase.from('tenants').select('name').eq('id', tenantId).single();
      if (t) setTenantName(t.name);
    }

    // Look up client — use service role via edge function
    const { data } = await supabase.functions.invoke('create-public-booking', {
      body: { action:'lookup-client', tenantId, clientPhone: cleanPhone },
    });

    if (!data?.found) { setError('No account found for this number. Book an appointment first!'); setPhase('phone'); return; }

    const c = data.client;
    setClient({ id:c.id, name:c.name, phone:cleanPhone, email:c.email, tier:c.tier, loyalty_points:c.loyaltyPoints, created_at:'' });

    // Load bookings
    const { data: bkgs } = await supabase.from('bookings')
      .select('id,service_name,booking_date,start_time,status,price,staff_id')
      .eq('client_id', c.id).order('booking_date', { ascending: false }).limit(20);
    setBookings(bkgs || []);

    // Load packages
    const { data: pkgs } = await supabase.from('client_packages')
      .select('id,sessions_total,sessions_used,sessions_remaining,expires_at,status,purchase_date,package:package_id(name,color)')
      .eq('client_id', c.id).order('created_at', { ascending: false });
    setPackages((pkgs || []) as ClientPkg[]);

    // Load loyalty history
    const { data: ltx } = await supabase.from('loyalty_transactions')
      .select('id,type,points,balance_after,note,created_at')
      .eq('client_id', c.id).order('created_at', { ascending: false }).limit(20);
    setLoyaltyTx((ltx || []) as LoyaltyTx[]);

    setPhase('portal');
  };

  // ── Phone/OTP screen ──────────────────────────────────────
  if (phase === 'phone') return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Scissors className="h-7 w-7 text-primary"/>
          </div>
          <h1 className="text-2xl font-black" style={{fontFamily:'Syne,sans-serif'}}>My Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tenantName ? `${tenantName} · ` : ''}View your bookings, points & packages
          </p>
        </div>

        {!otpSent ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Phone Number</label>
              <Input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+965 9XXX XXXX" className="h-11" dir="ltr"
                onKeyDown={e => e.key === 'Enter' && skipOtpLookup()}/>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button onClick={skipOtpLookup} disabled={sending} className="w-full h-11 gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Phone className="h-4 w-4"/>}
              {sending ? 'Looking up...' : 'View My Profile'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Your phone number is your account. No password needed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">Enter the 6-digit code sent to {phone}</p>
            <Input value={otp} onChange={e => setOtp(e.target.value)} placeholder="000000"
              maxLength={6} className="h-11 text-center text-2xl tracking-[0.5em] font-bold" dir="ltr"/>
            {error && <p className="text-xs text-destructive text-center">{error}</p>}
            <Button onClick={verifyOtp} disabled={sending||otp.length<6} className="w-full h-11">
              {sending ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Verify & Enter'}
            </Button>
            <button onClick={() => setOtpSent(false)} className="w-full text-xs text-muted-foreground hover:text-foreground">← Back</button>
          </div>
        )}
      </div>
    </div>
  );

  if (phase === 'loading') return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary"/>
    </div>
  );

  if (!client) return null;

  const tier = TIER_CFG[client.tier] || TIER_CFG.normal;
  const upcomingBookings = bookings.filter(b => ['confirmed','planned','in_service'].includes(b.status));
  const pastBookings     = bookings.filter(b => ['completed','cancelled'].includes(b.status));
  const activePackages   = packages.filter(p => p.status === 'active' && p.sessions_remaining > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-lg mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-black text-primary">
                {client.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-base">{client.name}</p>
                  {tier.icon}
                </div>
                <p className="text-xs text-muted-foreground">{client.phone}</p>
              </div>
            </div>
            {tenantId && (
              <Link to={`/book?tenant=${tenantId}`}>
                <Button size="sm" className="gap-1.5 h-8 text-xs">
                  <Scissors className="h-3 w-3"/>Book
                </Button>
              </Link>
            )}
          </div>

          {/* Points & stats row */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              {icon:'⭐', label:'Points',   val: client.loyalty_points,  color:'text-amber-600' },
              {icon:'📅', label:'Upcoming', val: upcomingBookings.length, color:'text-primary' },
              {icon:'🎁', label:'Packages', val: activePackages.length,   color:'text-emerald-600' },
            ].map(({icon,label,val,color}) => (
              <div key={label} className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xl">{icon}</p>
                <p className={cn('text-xl font-black stat-number', color)}>{val}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-5 py-4">
        <Tabs defaultValue="upcoming">
          <TabsList className="w-full h-9 bg-muted/50">
            <TabsTrigger value="upcoming"  className="flex-1 text-xs">Upcoming</TabsTrigger>
            <TabsTrigger value="history"   className="flex-1 text-xs">History</TabsTrigger>
            <TabsTrigger value="packages"  className="flex-1 text-xs">Packages</TabsTrigger>
            <TabsTrigger value="points"    className="flex-1 text-xs">Points</TabsTrigger>
          </TabsList>

          {/* Upcoming bookings */}
          <TabsContent value="upcoming" className="mt-4 space-y-3">
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30"/>
                <p className="text-sm font-medium">No upcoming appointments</p>
                {tenantId && (
                  <Link to={`/book?tenant=${tenantId}`}>
                    <Button size="sm" className="mt-3 gap-1.5"><Scissors className="h-3.5 w-3.5"/>Book Now</Button>
                  </Link>
                )}
              </div>
            ) : upcomingBookings.map(b => (
              <div key={b.id} className="border rounded-xl p-4 bg-card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{b.service_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(b.booking_date),'EEEE, MMM d')} · {b.start_time?.slice(0,5)}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('text-[9px] h-5 px-2 rounded-sm capitalize', STATUS_COLOR[b.status])}>
                    {b.status.replace('_',' ')}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>
                    {formatDistanceToNow(parseISO(b.booking_date), { addSuffix: true })}
                  </span>
                  <span className="font-bold stat-number text-foreground">{Number(b.price).toFixed(3)} KWD</span>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Visit history */}
          <TabsContent value="history" className="mt-4 space-y-2">
            {pastBookings.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30"/>
                <p className="text-sm">No visit history yet</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <p className="text-xl font-black stat-number text-primary">{pastBookings.filter(b=>b.status==='completed').length}</p>
                    <p className="text-[10px] text-muted-foreground">Completed Visits</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <p className="text-xl font-black stat-number text-emerald-600">
                      {pastBookings.filter(b=>b.status==='completed').reduce((s,b)=>s+Number(b.price),0).toFixed(3)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Total Spent (KWD)</p>
                  </div>
                </div>
                {pastBookings.map(b => (
                  <div key={b.id} className="border rounded-xl p-3 bg-card flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{b.service_name}</p>
                      <p className="text-[11px] text-muted-foreground">{format(parseISO(b.booking_date),'MMM d, yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold stat-number">{Number(b.price).toFixed(3)} KWD</p>
                      <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-sm capitalize', STATUS_COLOR[b.status])}>
                        {b.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </>
            )}
          </TabsContent>

          {/* Packages */}
          <TabsContent value="packages" className="mt-4 space-y-3">
            {packages.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Gift className="h-8 w-8 mx-auto mb-2 opacity-30"/>
                <p className="text-sm font-medium">No packages yet</p>
                <p className="text-xs mt-1 opacity-60">Ask your salon about multi-session packages</p>
              </div>
            ) : packages.map(p => {
              const pct = Math.round((p.sessions_used / p.sessions_total) * 100);
              return (
                <div key={p.id} className={cn('border rounded-xl p-4 bg-card', p.status!=='active'&&'opacity-55')}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm">{(p.package as any)?.name}</p>
                    <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-sm capitalize',
                      p.status==='active'?'bg-emerald-50 text-emerald-700 border-emerald-200':'border-border text-muted-foreground')}>
                      {p.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{width:`${pct}%`}}/>
                    </div>
                    <span className="text-xs font-bold stat-number">{p.sessions_remaining}/{p.sessions_total}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {p.sessions_remaining} session{p.sessions_remaining!==1?'s':''} remaining
                    {p.expires_at ? ` · Expires ${format(parseISO(p.expires_at),'MMM d, yyyy')}` : ''}
                  </p>
                </div>
              );
            })}
          </TabsContent>

          {/* Points history */}
          <TabsContent value="points" className="mt-4 space-y-3">
            {/* Balance card */}
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-5 text-center">
              <Star className="h-8 w-8 text-amber-400 mx-auto mb-1"/>
              <p className="text-4xl font-black stat-number text-amber-700 dark:text-amber-300">{client.loyalty_points}</p>
              <p className="text-sm text-amber-600/70 dark:text-amber-400/70">points balance</p>
            </div>

            {loyaltyTx.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">No points activity yet</div>
            ) : (
              <div className="border rounded-xl overflow-hidden divide-y divide-border">
                {loyaltyTx.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-medium capitalize">{t.type}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(t.created_at),{addSuffix:true})}
                        {t.note?` · ${t.note}`:''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-black stat-number', t.points>0?'text-emerald-600':'text-red-500')}>
                        {t.points>0?'+':''}{t.points}
                      </p>
                      <p className="text-[10px] text-muted-foreground">bal: {t.balance_after}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
