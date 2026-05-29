import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Sparkles, Crown, Zap, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PLAN_ICON: Record<string, any> = { starter: Sparkles, professional: Crown, ai: Zap };

interface PlanRow {
  id: string; code: string; name: string; name_ar: string | null;
  price_kwd: number; period: string; features: Record<string, any>;
  seat_limit: number | null; sort_order: number;
}
interface InvoiceRow {
  id: string; amount_kwd: number; status: string; issued_at: string;
  paid_at: string | null; plan_code: string | null; provider_ref: string | null;
}

const Subscription = () => {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ar = language === 'ar';
  const ent = useEntitlements();

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Show toast on return from MyFatoorah
  useEffect(() => {
    const s = params.get('status');
    if (s === 'success') {
      toast({ title: ar ? 'تمت عملية الدفع' : 'Payment received', description: ar ? 'يتم تفعيل اشتراكك...' : 'Activating your subscription...' });
      // Re-fetch after a beat (webhook may take a moment)
      setTimeout(() => { ent.refresh(); fetchInvoices(); }, 3000);
    } else if (s === 'failed') {
      toast({ title: ar ? 'فشل الدفع' : 'Payment failed', variant: 'destructive' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('subscription_plans')
        .select('*').eq('is_active', true).order('sort_order');
      setPlans((data ?? []) as PlanRow[]);
    })();
    fetchInvoices();
  }, [tenant?.id]);

  const fetchInvoices = async () => {
    if (!tenant?.id) return;
    const { data } = await (supabase as any).from('tenant_invoices')
      .select('id,amount_kwd,status,issued_at,paid_at,plan_code,provider_ref')
      .eq('tenant_id', tenant.id).order('issued_at', { ascending: false }).limit(12);
    setInvoices((data ?? []) as InvoiceRow[]);
  };

  const handleUpgrade = async (planCode: string) => {
    setLoadingPlan(planCode);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { plan_code: planCode },
      });
      if (error || !data?.payment_url) throw new Error((data as any)?.error || error?.message || 'Failed');
      window.location.href = data.payment_url;
    } catch (e: any) {
      toast({ title: ar ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' });
      setLoadingPlan(null);
    }
  };

  const isTrialActive = ent.status === 'trialing' && tenant?.trial_ends_at && new Date(tenant.trial_ends_at) > new Date();
  const trialDaysLeft = tenant?.trial_ends_at ? Math.max(0, differenceInDays(new Date(tenant.trial_ends_at), new Date())) : 0;
  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const currentPlan = ent.plan_code;
  const planLevel = (c: string) => ({ starter: 1, professional: 2, ai: 3 }[c] || 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">{ar ? 'الاشتراك' : 'Subscription'}</p>
        <h1 className="text-3xl font-bold tracking-tight">{ar ? 'خطتك الحالية' : 'Your Plan'}</h1>
      </div>

      {ent.status === 'expired' && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold text-sm">{ar ? 'انتهت تجربتك المجانية' : 'Your trial has ended'}</p>
              <p className="text-xs text-muted-foreground">{ar ? 'اختر خطة للاستمرار في استخدام ZAINA.' : 'Choose a plan to continue using ZAINA.'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isTrialActive ? (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">
                {ar ? `تجربتك المجانية تنتهي خلال ${trialDaysLeft} يوم` : `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''}`}
              </p>
              {trialEndsAt && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  {ar ? `حتى ${format(trialEndsAt, 'MMM d, yyyy')}` : `Until ${format(trialEndsAt, 'MMMM d, yyyy')}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : ent.status === 'active' && ent.current_period_end ? (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-200 text-sm">
                {ar ? 'اشتراكك نشط' : 'Your subscription is active'}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                {ar ? 'يتجدد في ' : 'Renews on '}{format(new Date(ent.current_period_end), 'MMMM d, yyyy')}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map(p => {
          const Icon = PLAN_ICON[p.code] || Sparkles;
          const isCurrent = p.code === currentPlan && (ent.status === 'active' || ent.status === 'trialing');
          const isUpgrade = planLevel(p.code) > planLevel(currentPlan);
          const featureList = Object.entries(p.features || {})
            .filter(([, v]) => v === true || (typeof v === 'number' && v !== 0))
            .map(([k]) => k.replace(/_/g, ' '));
          return (
            <Card key={p.code} className={cn('relative', isCurrent && 'border-primary')}>
              {isCurrent && <Badge className="absolute -top-2 right-3">{ar ? 'الحالية' : 'Current'}</Badge>}
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /><h3 className="font-bold text-lg">{ar ? (p.name_ar || p.name) : p.name}</h3></div>
                <div><span className="text-3xl font-bold">{Number(p.price_kwd).toFixed(3)}</span> <span className="text-sm text-muted-foreground">KWD/{p.period === 'monthly' ? (ar ? 'شهر' : 'mo') : p.period}</span></div>
                <ul className="space-y-2 text-sm">
                  {featureList.slice(0, 8).map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center mt-0.5 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-accent" />
                      </span>
                      <span className="capitalize">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn('w-full', isUpgrade && 'bg-accent text-accent-foreground hover:bg-accent/90')}
                  disabled={isCurrent || loadingPlan === p.code}
                  variant={isUpgrade ? 'default' : 'outline'}
                  onClick={() => handleUpgrade(p.code)}
                >
                  {loadingPlan === p.code ? <Loader2 className="h-4 w-4 animate-spin" /> :
                   isCurrent ? (ar ? 'خطتك الحالية' : 'Current plan') :
                   isUpgrade ? (ar ? 'ترقية' : 'Upgrade') : (ar ? 'تبديل' : 'Switch')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Invoice history */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3">{ar ? 'سجل الفواتير' : 'Invoice history'}</h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ar ? 'لا توجد فواتير حتى الآن' : 'No invoices yet'}</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{ar ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead>{ar ? 'الخطة' : 'Plan'}</TableHead>
                <TableHead>{ar ? 'المبلغ' : 'Amount'}</TableHead>
                <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-xs">Ref</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{format(new Date(inv.issued_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-sm capitalize">{inv.plan_code}</TableCell>
                    <TableCell className="text-sm">{Number(inv.amount_kwd).toFixed(3)} KWD</TableCell>
                    <TableCell><Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'failed' ? 'destructive' : 'secondary'}>{inv.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{inv.provider_ref?.slice(0, 10)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Subscription;
