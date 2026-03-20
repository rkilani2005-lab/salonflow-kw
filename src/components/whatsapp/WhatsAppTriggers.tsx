import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, Bell, ReceiptText, XCircle, Clock, MessageSquareHeart, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Trigger {
  id: string;
  event_type: string;
  is_active: boolean;
  delay_minutes: number;
  send_to: string;
  template?: { name: string; body_en: string };
}

const EVENT_META: Record<string, {
  label: string; labelAr: string; icon: React.ComponentType<{className?:string}>;
  desc: string; descAr: string; color: string;
}> = {
  booking_confirmed: {
    label: 'Booking Confirmed',  labelAr: 'تأكيد الحجز',
    icon: Zap, color: 'text-emerald-600',
    desc: 'Sent immediately when a booking is confirmed. Includes service, date, time and stylist.',
    descAr: 'يُرسل فور تأكيد الحجز. يتضمن الخدمة والتاريخ والوقت والموظفة.',
  },
  reminder_24h: {
    label: '24-Hour Reminder', labelAr: 'تذكير قبل 24 ساعة',
    icon: Bell, color: 'text-blue-600',
    desc: 'Sent the day before the appointment. Reduces no-shows significantly.',
    descAr: 'يُرسل يوم قبل الموعد. يقلل حالات عدم الحضور بشكل ملحوظ.',
  },
  reminder_1h: {
    label: '1-Hour Reminder',   labelAr: 'تذكير قبل ساعة',
    icon: Clock, color: 'text-violet-600',
    desc: 'Sent one hour before the appointment time.',
    descAr: 'يُرسل قبل ساعة من وقت الموعد.',
  },
  booking_cancelled: {
    label: 'Booking Cancelled', labelAr: 'إلغاء الحجز',
    icon: XCircle, color: 'text-red-500',
    desc: 'Sent when a booking is cancelled. Includes a rebooking reminder.',
    descAr: 'يُرسل عند إلغاء الحجز. يتضمن تذكيراً بإعادة الحجز.',
  },
  receipt_sent: {
    label: 'Payment Receipt',   labelAr: 'إيصال الدفع',
    icon: ReceiptText, color: 'text-amber-600',
    desc: 'Sent after checkout. Includes itemized services and payment summary.',
    descAr: 'يُرسل بعد إتمام الدفع. يتضمن تفاصيل الخدمات وملخص الدفع.',
  },
  reengagement: {
    label: 'Re-engagement',     labelAr: 'إعادة التواصل',
    icon: MessageSquareHeart, color: 'text-pink-600',
    desc: 'Sent to clients who haven\'t visited in 30+ days. Runs as a campaign.',
    descAr: 'يُرسل للعميلات اللواتي لم يزرن منذ 30+ يوماً. يعمل كحملة.',
  },
};

export function WhatsAppTriggers() {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [seeding,  setSeeding]  = useState(false);

  useEffect(() => { if (tenant?.id) loadTriggers(); }, [tenant?.id]);

  const loadTriggers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_triggers')
      .select('*, template:whatsapp_templates(name, body_en)')
      .eq('tenant_id', tenant!.id)
      .order('created_at');
    setTriggers((data || []) as Trigger[]);
    setLoading(false);
  };

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      // Seed templates then triggers
      await supabase.rpc('seed_whatsapp_templates', { p_tenant_id: tenant!.id });
      await supabase.rpc('seed_whatsapp_triggers',  { p_tenant_id: tenant!.id });
      await loadTriggers();
      toast({ title: '✅ Default automations created' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const toggleTrigger = async (trigger: Trigger) => {
    setSaving(trigger.id);
    try {
      await supabase.from('whatsapp_triggers')
        .update({ is_active: !trigger.is_active })
        .eq('id', trigger.id);
      setTriggers(prev => prev.map(t => t.id === trigger.id ? { ...t, is_active: !t.is_active } : t));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (triggers.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
        <Zap className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-base">No automations yet</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Create the default 5 automations with one click. You can customize them afterwards.
        </p>
      </div>
      <Button onClick={seedDefaults} disabled={seeding} className="gap-2">
        {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        Create Default Automations
      </Button>
    </div>
  );

  const activeCount = triggers.filter(t => t.is_active).length;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{activeCount} of {triggers.length} automations active</p>
          <p className="text-xs text-muted-foreground mt-0.5">Messages sent automatically from your WhatsApp number</p>
        </div>
        <Button size="sm" variant="outline" onClick={loadTriggers} className="gap-1.5 text-xs h-8">
          <RefreshCw className="h-3 w-3" />Refresh
        </Button>
      </div>

      {/* Triggers list */}
      <div className="border rounded-md overflow-hidden divide-y divide-border">
        {Object.entries(EVENT_META).map(([eventType, meta]) => {
          const trigger = triggers.find(t => t.event_type === eventType);
          const Icon = meta.icon;
          if (!trigger) return null;

          return (
            <div key={eventType} className={cn(
              'flex items-start gap-4 px-5 py-4 transition-colors',
              trigger.is_active ? 'bg-card' : 'bg-muted/20 opacity-70'
            )}>
              {/* Icon */}
              <div className={cn('h-9 w-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5')}>
                <Icon className={cn('h-4 w-4', meta.color)} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-sm font-bold">
                    → {trigger.send_to}
                  </Badge>
                  {trigger.is_active && (
                    <Badge className="text-[9px] h-4 px-1.5 rounded-sm font-bold bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{meta.desc}</p>
                {trigger.template?.name && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Template: <span className="font-medium">{trigger.template.name}</span>
                  </p>
                )}
              </div>

              {/* Toggle */}
              <div className="flex-shrink-0 mt-1">
                {saving === trigger.id
                  ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  : <Switch checked={trigger.is_active} onCheckedChange={() => toggleTrigger(trigger)} />}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        💡 Reminders (24h and 1h) require a scheduled job. Contact support to enable automatic scheduling, or trigger them manually from the appointment calendar.
      </p>
    </div>
  );
}
