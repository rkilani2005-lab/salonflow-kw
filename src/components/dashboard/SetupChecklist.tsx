import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, ChevronRight, Sparkles, Building2, UserCog, Scissors, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface CheckItem {
  key: string;
  en: string;
  ar: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  routeLabel: { en: string; ar: string };
  done: boolean;
  weight: number; // percentage contribution
}

function useSetupChecklist(tenantId?: string) {
  return useQuery({
    queryKey: ['setup-checklist', tenantId],
    queryFn: async () => {
      const [branches, staff, services] = await Promise.all([
        supabase.from('branches').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!).eq('is_active', true),
        supabase.from('staff').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!).eq('is_active', true),
        supabase.from('services').select('id', { count: 'exact', head: true }),
      ]);
      return {
        hasBranch:  (branches.count  || 0) >= 1,
        hasStaff:   (staff.count     || 0) >= 1,
        hasService: (services.count  || 0) >= 1,
      };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

interface Props {
  /** If true, always show the checklist even after 100% */
  alwaysShow?: boolean;
}

export function SetupChecklist({ alwaysShow = false }: Props) {
  const { tenant, profile } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === 'ar';
  const [dismissed, setDismissed] = useState(false);

  const { data: checks, isLoading } = useSetupChecklist(tenant?.id);

  if (isLoading || !checks) return null;

  // Owner account = profile existing with tenant_id
  const hasOwner = !!profile?.user_id && !!tenant?.id;

  const items: CheckItem[] = [
    {
      key: 'branch',
      en: 'Add at least one branch / location',
      ar: 'أضف فرعاً واحداً على الأقل',
      icon: Building2,
      route: '/settings',
      routeLabel: { en: 'Add Branch', ar: 'إضافة فرع' },
      done: checks.hasBranch,
      weight: 25,
    },
    {
      key: 'owner',
      en: 'Admin owner account created',
      ar: 'تم إنشاء حساب المالك',
      icon: UserCog,
      route: '/settings',
      routeLabel: { en: 'View Settings', ar: 'عرض الإعدادات' },
      done: hasOwner,
      weight: 25,
    },
    {
      key: 'staff',
      en: 'Add at least one stylist / staff member',
      ar: 'أضف موظفة واحدة على الأقل',
      icon: UserCog,
      route: '/staff',
      routeLabel: { en: 'Add Staff', ar: 'إضافة موظفة' },
      done: checks.hasStaff,
      weight: 25,
    },
    {
      key: 'service',
      en: 'Add at least one service',
      ar: 'أضف خدمة واحدة على الأقل',
      icon: Scissors,
      route: '/services',
      routeLabel: { en: 'Add Service', ar: 'إضافة خدمة' },
      done: checks.hasService,
      weight: 25,
    },
  ];

  const completedWeight = items.filter(i => i.done).reduce((sum, i) => sum + i.weight, 0);
  const pct = completedWeight; // sum of weights = 0-100
  const allDone = pct === 100;

  // Hide if all done AND not forced AND not dismissed
  if (allDone && !alwaysShow) return null;
  // Hide if manually dismissed
  if (dismissed && !alwaysShow) return null;

  const doneCount = items.filter(i => i.done).length;

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      allDone
        ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-900/10'
        : 'border-primary/20 bg-primary/5'
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
        <div className={cn(
          'h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0',
          allDone ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-primary/10'
        )}>
          <Sparkles className={cn('h-4 w-4', allDone ? 'text-emerald-600' : 'text-primary')} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {allDone
              ? (ar ? '🎉 صالونك جاهز تماماً!' : '🎉 Your salon is fully set up!')
              : (ar ? 'إعداد صالونك' : 'Complete your salon setup')}
          </p>
          <p className="text-xs text-muted-foreground">
            {ar
              ? `${doneCount} من ${items.length} مكتملة`
              : `${doneCount} of ${items.length} completed`}
          </p>
        </div>

        {/* Progress ring + percentage */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative h-12 w-12">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={allDone ? '#10b981' : 'hsl(var(--primary))'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset="0"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold">{pct}%</span>
            </div>
          </div>

          {!alwaysShow && (
            <button
              onClick={() => setDismissed(true)}
              className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={ar ? 'إخفاء' : 'Dismiss'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className={cn('h-full transition-all duration-700 rounded-r-full', allDone ? 'bg-emerald-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="divide-y divide-border/40">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className={cn(
                'flex items-center gap-4 px-5 py-3.5 transition-colors',
                item.done ? 'opacity-60' : 'hover:bg-background/60'
              )}
            >
              {/* Status icon */}
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
              )}

              {/* Item icon */}
              <div className={cn(
                'h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0',
                item.done ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'
              )}>
                <Icon className={cn('h-3.5 w-3.5', item.done ? 'text-emerald-600' : 'text-muted-foreground')} />
              </div>

              {/* Label */}
              <p className={cn('flex-1 text-sm', item.done ? 'line-through text-muted-foreground' : 'font-medium')} dir={ar ? 'rtl' : 'ltr'}>
                {ar ? item.ar : item.en}
              </p>

              {/* Badge */}
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full flex-shrink-0">
                {item.weight}%
              </span>

              {/* CTA */}
              {!item.done && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(item.route)}
                  className="h-7 text-xs gap-1 flex-shrink-0 border-primary/30 text-primary hover:bg-primary/5"
                >
                  {ar ? item.routeLabel.ar : item.routeLabel.en}
                  <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Trial banner inside checklist */}
      {tenant?.is_trial && tenant?.trial_ends_at && (
        <div className="px-5 py-3 bg-amber-50/60 dark:bg-amber-900/10 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {ar
              ? `تجربتك المجانية نشطة حتى ${new Date(tenant.trial_ends_at).toLocaleDateString('ar-KW')}`
              : `Free trial active until ${new Date(tenant.trial_ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
      )}
    </div>
  );
}
