import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Circle, ExternalLink, Copy, RefreshCw,
  Loader2, Smartphone, Key, Globe, Webhook, TestTube2,
  AlertTriangle, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetupStep {
  id: number;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  hrefLabel?: string;
}

const STEPS: SetupStep[] = [
  {
    id: 1, icon: Globe,
    title: 'Create Meta Business Account',
    titleAr: 'إنشاء حساب Meta Business',
    description: 'Go to business.facebook.com and create or log into your Meta Business account. This is required to use the WhatsApp Business API.',
    descriptionAr: 'اذهب إلى business.facebook.com وأنشئ حساب Meta Business أو سجل الدخول. هذا مطلوب لاستخدام WhatsApp Business API.',
    href: 'https://business.facebook.com',
    hrefLabel: 'Open Meta Business →',
  },
  {
    id: 2, icon: Smartphone,
    title: 'Create WhatsApp Business App',
    titleAr: 'إنشاء تطبيق WhatsApp Business',
    description: '1. Go to developers.facebook.com → Create App → Select "Business"\n2. Add the WhatsApp product to your app\n3. In WhatsApp → Getting Started: add a phone number and verify it via OTP\n4. Note your Phone Number ID and WhatsApp Business Account ID (WABA ID)',
    descriptionAr: '١. اذهب إلى developers.facebook.com → أنشئ تطبيق → اختر "Business"\n٢. أضف منتج WhatsApp لتطبيقك\n٣. في WhatsApp → Getting Started: أضف رقم هاتف وتحقق منه عبر OTP\n٤. احفظ Phone Number ID و WhatsApp Business Account ID (WABA ID)',
    href: 'https://developers.facebook.com/apps',
    hrefLabel: 'Open Meta Developers →',
  },
  {
    id: 3, icon: Key,
    title: 'Generate Permanent Access Token',
    titleAr: 'إنشاء رمز وصول دائم',
    description: '1. In your Meta Business account → Settings → Users → System Users\n2. Create a System User with "Admin" role\n3. Click "Generate new token"\n4. Select your app and grant permissions:\n   • whatsapp_business_messaging\n   • whatsapp_business_management\n5. Copy the token — it does not expire',
    descriptionAr: '١. في حساب Meta Business → الإعدادات → المستخدمون → مستخدمو النظام\n٢. أنشئ مستخدم نظام بدور "Admin"\n٣. انقر "Generate new token"\n٤. اختر تطبيقك ومنح الصلاحيات:\n   • whatsapp_business_messaging\n   • whatsapp_business_management\n٥. انسخ الرمز — لا تاريخ انتهاء',
    href: 'https://business.facebook.com/settings/system-users',
    hrefLabel: 'Open System Users →',
  },
  {
    id: 4, icon: Webhook,
    title: 'Register Webhook',
    titleAr: 'تسجيل الـ Webhook',
    description: '1. In your app → WhatsApp → Configuration → Webhook\n2. Click "Edit"\n3. Paste your Webhook URL (shown below)\n4. Paste your Verify Token (shown below)\n5. Click "Verify and Save"\n6. Under "Webhook fields" → Subscribe to: messages',
    descriptionAr: '١. في تطبيقك → WhatsApp → Configuration → Webhook\n٢. انقر "Edit"\n٣. الصق Webhook URL (موضح أدناه)\n٤. الصق Verify Token (موضح أدناه)\n٥. انقر "Verify and Save"\n٦. في "Webhook fields" → اشترك في: messages',
  },
  {
    id: 5, icon: TestTube2,
    title: 'Enter Credentials & Test',
    titleAr: 'أدخل البيانات واختبر',
    description: 'Enter your credentials below and click "Test Connection" to verify everything works.',
    descriptionAr: 'أدخل بياناتك أدناه وانقر "اختبار الاتصال" للتحقق.',
  },
];

export function WhatsAppSetup() {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState(1);
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied,  setCopied]  = useState<string | null>(null);

  // Credential fields
  const [phoneNumberId,    setPhoneNumberId]    = useState('');
  const [wabaId,           setWabaId]           = useState('');
  const [accessToken,      setAccessToken]      = useState('');
  const [displayPhone,     setDisplayPhone]     = useState('');
  const [connectionStatus, setConnectionStatus] = useState('not_connected');
  const [verifyToken,      setVerifyToken]      = useState('');
  const [configId,         setConfigId]         = useState<string | null>(null);

  // Load existing config
  useEffect(() => {
    if (!tenant?.id) return;
    (supabase as any).from('whatsapp_config').select('id, tenant_id, phone_number_id, waba_id, access_token, webhook_verify_token, is_active, is_enabled, business_name, display_phone_number, connection_status').eq('tenant_id', tenant.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setConfigId(data.id);
        setPhoneNumberId((data as any).phone_number_id || '');
        setWabaId((data as any).waba_id || '');
        setAccessToken((data as any).access_token || '');
        setDisplayPhone((data as any).display_phone_number || '');
        setConnectionStatus((data as any).connection_status || 'not_connected');
        setVerifyToken((data as any).webhook_verify_token || '');
        if ((data as any).phone_number_id && (data as any).access_token) setActiveStep(5);
      });
  }, [tenant?.id]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const payload = {
        tenant_id:            tenant.id,
        phone_number_id:      phoneNumberId.trim(),
        waba_id:              wabaId.trim(),
        access_token:         accessToken.trim(),
        display_phone_number: displayPhone.trim(),
      };

      if (configId) {
        const { error } = await supabase.from('whatsapp_config').update(payload).eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('whatsapp_config').insert({ ...payload, is_enabled: false }).select().single();
        if (error) throw error;
        setConfigId(data.id);
        setVerifyToken((data as any).webhook_verify_token || '');
      }

      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      toast({ title: '✅ Credentials saved' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!tenant?.id || !phoneNumberId || !accessToken) {
      toast({ title: 'Enter credentials first', variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      // Test by fetching phone number details from Meta
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,platform_type`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error?.message || `Meta API error: ${res.status}`);
      }

      // Update status
      await supabase.from('whatsapp_config').update({
        connection_status: 'connected',
        display_phone_number: data.display_phone_number || displayPhone,
        last_connected_at: new Date().toISOString(),
        business_name: data.verified_name || '',
        is_enabled: true,
      } as any).eq('tenant_id', tenant.id);

      setConnectionStatus('connected');
      setDisplayPhone(data.display_phone_number || displayPhone);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });

      toast({ title: `✅ Connected! ${data.display_phone_number} (${data.verified_name})` });
    } catch (err: any) {
      await supabase.from('whatsapp_config').update({ connection_status: 'error' } as any).eq('tenant_id', tenant.id);
      setConnectionStatus('error');
      toast({ title: '❌ Connection failed', description: err.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const statusBadge = () => {
    if (connectionStatus === 'connected') return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300 dark:border-emerald-700 text-[10px] font-bold rounded-sm border">● Connected</Badge>;
    if (connectionStatus === 'error')     return <Badge className="bg-red-500/10 text-red-600 border-red-300 dark:border-red-700 text-[10px] font-bold rounded-sm border">● Error</Badge>;
    return <Badge className="bg-muted text-muted-foreground text-[10px] font-bold rounded-sm border border-border">○ Not connected</Badge>;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Status banner */}
      <div className="flex items-center justify-between p-4 rounded-md border bg-card">
        <div>
          <p className="text-sm font-semibold">WhatsApp Business API</p>
          <p className="text-xs text-muted-foreground mt-0.5">{displayPhone || 'No number connected'}</p>
        </div>
        {statusBadge()}
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const done = i + 1 < activeStep || (i + 1 === 5 && connectionStatus === 'connected');
          const active = i + 1 === activeStep;
          return (
            <div key={step.id} className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setActiveStep(step.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border',
                  active  ? 'bg-primary text-primary-foreground border-primary' :
                  done    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' :
                            'bg-muted text-muted-foreground border-border hover:border-primary/40'
                )}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                {step.id}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Active step content */}
      {STEPS.map(step => {
        if (step.id !== activeStep) return null;
        const Icon = step.icon;
        return (
          <div key={step.id} className="border rounded-md bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/30">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Step {step.id}: {step.title}</p>
              </div>
              {step.href && (
                <a href={step.href} target="_blank" rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline font-medium flex-shrink-0">
                  {step.hrefLabel}<ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Instructions */}
              {step.id !== 5 && (
                <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {step.description}
                </div>
              )}

              {/* Step 4 — Webhook info */}
              {step.id === 4 && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Webhook URL — paste this in Meta</Label>
                    <div className="flex gap-2">
                      <Input value={webhookUrl} readOnly className="h-9 text-xs font-mono bg-muted/50" />
                      <Button size="sm" variant="outline" className="h-9 gap-1.5 flex-shrink-0"
                        onClick={() => copyToClipboard(webhookUrl, 'webhook')}>
                        <Copy className="h-3.5 w-3.5" />
                        {copied === 'webhook' ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Verify Token — paste this in Meta</Label>
                    <div className="flex gap-2">
                      <Input value={verifyToken || 'Save credentials first to generate'} readOnly className="h-9 text-xs font-mono bg-muted/50" />
                      <Button size="sm" variant="outline" className="h-9 gap-1.5 flex-shrink-0"
                        onClick={() => copyToClipboard(verifyToken, 'token')} disabled={!verifyToken}>
                        <Copy className="h-3.5 w-3.5" />
                        {copied === 'token' ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Make sure you subscribe to the <strong>messages</strong> field in Webhook Fields after verifying.</span>
                  </div>
                </div>
              )}

              {/* Step 5 — Credentials form */}
              {step.id === 5 && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Phone Number ID *</Label>
                      <Input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)}
                        className="h-9 font-mono text-sm" placeholder="1234567890" />
                      <p className="text-[10px] text-muted-foreground">From WhatsApp → Getting Started in Meta Developers</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">WABA ID (Business Account ID) *</Label>
                      <Input value={wabaId} onChange={e => setWabaId(e.target.value)}
                        className="h-9 font-mono text-sm" placeholder="0987654321" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Permanent Access Token *</Label>
                    <Input value={accessToken} onChange={e => setAccessToken(e.target.value)}
                      type="password" className="h-9 font-mono text-sm" placeholder="EAAxxxxxxx..." />
                    <p className="text-[10px] text-muted-foreground">System User token from Meta Business Settings — never expires</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Display Phone Number</Label>
                    <Input value={displayPhone} onChange={e => setDisplayPhone(e.target.value)}
                      className="h-9" placeholder="+965 9XXX XXXX" />
                    <p className="text-[10px] text-muted-foreground">The number clients will see messages from (auto-filled on test)</p>
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Save Credentials
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !phoneNumberId || !accessToken} className="gap-1.5">
                      {testing
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <TestTube2 className="h-3.5 w-3.5" />}
                      Test Connection
                    </Button>
                  </div>

                  {connectionStatus === 'connected' && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                      <span><strong>Connected!</strong> WhatsApp is active. Go to the Triggers tab to enable automations.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between px-5 py-3 border-t bg-muted/20">
              <Button size="sm" variant="ghost" onClick={() => setActiveStep(s => Math.max(1, s - 1))} disabled={activeStep === 1} className="text-xs">
                ← Previous
              </Button>
              <Button size="sm" onClick={() => setActiveStep(s => Math.min(5, s + 1))} disabled={activeStep === 5} className="text-xs gap-1">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
