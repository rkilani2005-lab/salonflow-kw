import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import {
  Building2, Clock, Bell, Globe, Save, Upload, User, Phone,
  MapPin, CheckCircle2, Loader2, ImageIcon, X, Calendar, Link, Copy, Check,
  MessageCircle, QrCode, Power, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { useChannelAccounts } from '@/hooks/useChannelAccounts';

const DAYS = [
  { key: 'sun', en: 'Sunday',    ar: 'الأحد' },
  { key: 'mon', en: 'Monday',    ar: 'الاثنين' },
  { key: 'tue', en: 'Tuesday',   ar: 'الثلاثاء' },
  { key: 'wed', en: 'Wednesday', ar: 'الأربعاء' },
  { key: 'thu', en: 'Thursday',  ar: 'الخميس' },
  { key: 'fri', en: 'Friday',    ar: 'الجمعة' },
  { key: 'sat', en: 'Saturday',  ar: 'السبت' },
];

// Default: Sun–Thu open, Fri closed, Sat open (Kuwait working week)
const DEFAULT_WORKING_DAYS: Record<string, boolean> = {
  sun: true, mon: true, tue: true, wed: true, thu: true, fri: false, sat: true,
};

export default function Settings() {
  const { tenant, profile, currentBranch, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  // Allow deep-linking to a specific tab — used by the global
  // disconnection banner which navigates to /settings?tab=channels.
  const initialTab = searchParams.get('tab') ?? 'business';
  const { language } = useLanguage();
  const { toast } = useToast();
  const ar = language === 'ar';

  const [saving, setSaving]       = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Business fields ─────────────────────────────────────────
  const [businessName, setBusinessName] = useState('');
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null);
  const [ownerName,    setOwnerName]    = useState('');
  const [ownerPhone,   setOwnerPhone]   = useState('');
  const [phone,        setPhone]        = useState('');
  const [address,      setAddress]      = useState('');
  const [currency,     setCurrency]     = useState('KWD');
  const [taxRate,      setTaxRate]      = useState('0');

  // ── Working hours ────────────────────────────────────────────
  const [openTime,     setOpenTime]     = useState('09:00');
  const [closeTime,    setCloseTime]    = useState('21:00');
  const [workingDays,  setWorkingDays]  = useState<Record<string, boolean>>(DEFAULT_WORKING_DAYS);

  // ── Notification prefs (persisted in tenants.metadata or localStorage) ──
  const [emailNotif,   setEmailNotif]   = useState(true);
  const [smsNotif,     setSmsNotif]     = useState(true);
  const [bookingReminders, setBookingReminders] = useState(true);
  const [marketingEmails,  setMarketingEmails]  = useState(false);

  // ── Saved indicator per tab ─────────────────────────────────
  const [savedTab, setSavedTab] = useState<string | null>(null);

  // ── Load from context ────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
    if (tenant) {
      setBusinessName(tenant.name || '');
      setLogoUrl(tenant.logo_url || null);
      setCurrency(tenant.currency || 'KWD');
      setTaxRate(String(tenant.default_tax_rate ?? 0));
    }
    if (profile) {
      setOwnerName(profile.full_name || '');
      setOwnerPhone(profile.phone || '');
    }
    if (currentBranch) {
      setPhone(currentBranch.phone || '');
      setAddress(currentBranch.address || '');
      setOpenTime(currentBranch.opening_time?.slice(0, 5) || '09:00');
      setCloseTime(currentBranch.closing_time?.slice(0, 5) || '21:00');
    }
    // Load notification prefs from DB (fallback to localStorage for backward compat)
    if (tenant?.id) {
    try {
      const { data: tenantRow } = await supabase
        .from('tenants').select('notification_prefs').eq('id', tenant.id).single();
      const prefs = tenantRow?.notification_prefs as any;
      if (prefs) {
        setEmailNotif(prefs.emailNotif   ?? true);
        setSmsNotif(prefs.smsNotif       ?? true);
        setBookingReminders(prefs.bookingReminders ?? true);
        setMarketingEmails(prefs.marketingEmails   ?? false);
      } else {
        // fallback: read from localStorage if DB has no prefs yet
        const stored = localStorage.getItem(`notif_prefs_${tenant?.id}`);
        if (stored) {
          const p = JSON.parse(stored);
          setEmailNotif(p.emailNotif ?? true);
          setSmsNotif(p.smsNotif ?? true);
          setBookingReminders(p.bookingReminders ?? true);
          setMarketingEmails(p.marketingEmails ?? false);
        }
      }
    } catch { /* ignore */ }
    } // end if tenant
    // Load working days from DB (fallback to localStorage)
    if (currentBranch?.id) {
    try {
      const { data: branchRow } = await supabase
        .from('branches').select('working_days').eq('id', currentBranch.id).single();
      if (branchRow?.working_days) {
        setWorkingDays(branchRow.working_days as Record<string, boolean>);
      } else {
        const storedDays = localStorage.getItem(`working_days_${currentBranch?.id}`);
        if (storedDays) setWorkingDays(JSON.parse(storedDays));
      }
    } catch { /* ignore */ }
    } // end if currentBranch
    }; // end async init
    init();
  }, [tenant, profile, currentBranch]);

  // ── Logo upload ──────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: ar ? 'الملف كبير جداً' : 'File too large', description: ar ? 'الحد الأقصى 2MB' : 'Maximum size is 2MB', variant: 'destructive' });
      return;
    }

    setUploadingLogo(true);
    try {
      const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${tenant.id}/logo.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(path);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache-bust

      // Save URL to tenants table
      const { error: dbError } = await supabase
        .from('tenants')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', tenant.id);

      if (dbError) throw dbError;

      setLogoUrl(publicUrl);
      await refreshProfile();
      toast({ title: ar ? 'تم رفع الشعار' : 'Logo uploaded successfully' });
    } catch (err: any) {
      console.error('Logo upload error:', err);
      toast({
        title: ar ? 'فشل رفع الشعار' : 'Logo upload failed',
        description: err?.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!tenant?.id) return;
    const { error } = await supabase
      .from('tenants')
      .update({ logo_url: null })
      .eq('id', tenant.id);
    if (!error) {
      setLogoUrl(null);
      await refreshProfile();
      toast({ title: ar ? 'تم حذف الشعار' : 'Logo removed' });
    }
  };

  // ── Save business + branch settings ─────────────────────────
  const handleSaveBusiness = async () => {
    if (!tenant?.id || !profile?.user_id) return;
    setSaving(true);
    try {
      // 1. Update tenant
      const { error: tenantErr } = await supabase
        .from('tenants')
        .update({
          name:             businessName.trim(),
          currency,
          default_tax_rate: parseFloat(taxRate) || 0,
        })
        .eq('id', tenant.id);
      if (tenantErr) throw tenantErr;

      // 2. Update profile (owner name + phone)
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          full_name: ownerName.trim(),
          phone:     ownerPhone.trim() || null,
        })
        .eq('user_id', profile.user_id);
      if (profileErr) throw profileErr;

      // 3. Update branch
      if (currentBranch?.id) {
        const { error: branchErr } = await supabase
          .from('branches')
          .update({
            phone:        phone.trim() || null,
            address:      address.trim() || null,
          })
          .eq('id', currentBranch.id);
        if (branchErr) throw branchErr;
      }

      await refreshProfile();
      showSaved('business');
    } catch (err: any) {
      console.error('Save business error:', err);
      toast({ title: ar ? 'فشل الحفظ' : 'Save failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Save working hours ───────────────────────────────────────
  const handleSaveHours = async () => {
    if (!currentBranch?.id) {
      toast({ title: ar ? 'لا يوجد فرع محدد' : 'No branch selected', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('branches')
        .update({
          opening_time: openTime + ':00',
          closing_time: closeTime + ':00',
        })
        .eq('id', currentBranch.id);
      if (error) throw error;

      // Persist working days to DB (not localStorage — device-independent)
      await supabase
        .from('branches')
        .update({ working_days: workingDays } as any)
        .eq('id', currentBranch.id);

      await refreshProfile();
      showSaved('hours');
    } catch (err: any) {
      console.error('Save hours error:', err);
      toast({ title: ar ? 'فشل الحفظ' : 'Save failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Save notification preferences (to DB) ───────────────────
  const handleSaveNotifications = async () => {
    if (!tenant?.id) return;
    try {
      await supabase.from('tenants')
        .update({ notification_prefs: { emailNotif, smsNotif, bookingReminders, marketingEmails } } as any)
        .eq('id', tenant.id);
      showSaved('notifications');
    } catch {
      toast({ title: ar ? 'فشل الحفظ' : 'Save failed', variant: 'destructive' });
    }
  };

  // ── Save currency/preferences ────────────────────────────────
  const handleSavePreferences = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ currency })
        .eq('id', tenant.id);
      if (error) throw error;
      await refreshProfile();
      showSaved('preferences');
    } catch (err: any) {
      toast({ title: ar ? 'فشل الحفظ' : 'Save failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const showSaved = (tab: string) => {
    setSavedTab(tab);
    setTimeout(() => setSavedTab(null), 3000);
  };

  const toggleDay = (key: string) =>
    setWorkingDays(d => ({ ...d, [key]: !d[key] }));

  // ── SaveBar component ────────────────────────────────────────
  const SaveBar = ({ tab, onSave }: { tab: string; onSave: () => void }) => (
    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
      {savedTab === tab && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium animate-in fade-in">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {ar ? 'تم الحفظ بنجاح' : 'Saved successfully'}
        </div>
      )}
      <Button onClick={onSave} disabled={saving} size="sm" className="gap-2 min-w-[110px]">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {saving ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ التغييرات' : 'Save Changes')}
      </Button>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
          {ar ? 'الإعدادات' : 'Settings'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {ar ? 'إدارة إعدادات وتفضيلات صالونك' : "Manage your salon's settings and preferences"}
        </p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 h-10">
          <TabsTrigger value="business"      className="text-xs gap-1.5"><Building2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">{ar ? 'النشاط' : 'Business'}</span></TabsTrigger>
          <TabsTrigger value="hours"         className="text-xs gap-1.5"><Clock     className="h-3.5 w-3.5" /><span className="hidden sm:inline">{ar ? 'الأوقات' : 'Hours'}</span></TabsTrigger>
          <TabsTrigger value="channels"      className="text-xs gap-1.5"><MessageCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">{ar ? 'القنوات' : 'Channels'}</span></TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1.5"><Bell      className="h-3.5 w-3.5" /><span className="hidden sm:inline">{ar ? 'الإشعارات' : 'Notifications'}</span></TabsTrigger>
          <TabsTrigger value="preferences"   className="text-xs gap-1.5"><Globe     className="h-3.5 w-3.5" /><span className="hidden sm:inline">{ar ? 'التفضيلات' : 'Preferences'}</span></TabsTrigger>
          <TabsTrigger value="booking"       className="text-xs gap-1.5"><Calendar  className="h-3.5 w-3.5" /><span className="hidden sm:inline">{ar ? 'الحجز' : 'Booking'}</span></TabsTrigger>
        </TabsList>

        {/* ── Business Profile ── */}
        <TabsContent value="business" className="space-y-5">
          <Card className="border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{ar ? 'معلومات النشاط التجاري' : 'Business Profile'}</CardTitle>
              <CardDescription className="text-xs">{ar ? 'تحديث معلومات صالونك' : "Update your salon's business information"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Logo upload */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">{ar ? 'شعار الصالون' : 'Salon Logo'}</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-border relative overflow-hidden flex-shrink-0">
                    {logoUrl ? (
                      <>
                        <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                        <button
                          onClick={handleRemoveLogo}
                          className="absolute top-1 right-1 h-5 w-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                    )}
                    {uploadingLogo && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="gap-2"
                    >
                      {uploadingLogo
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{ar ? 'جارٍ الرفع...' : 'Uploading...'}</>
                        : <><Upload className="h-3.5 w-3.5" />{ar ? 'رفع شعار' : 'Upload Logo'}</>}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      {ar ? 'PNG أو JPG حتى 2MB. الحجم المثالي: 200×200' : 'PNG, JPG or WebP up to 2MB. Ideal: 200×200px'}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Business name */}
              <div className="grid gap-1.5">
                <Label htmlFor="businessName" className="text-sm font-medium">
                  <Building2 className="h-3.5 w-3.5 inline mr-1.5" />
                  {ar ? 'اسم الصالون *' : 'Business Name *'}
                </Label>
                <Input id="businessName" value={businessName} onChange={e => setBusinessName(e.target.value)}
                  placeholder={ar ? 'اسم صالونك' : 'Your Salon Name'} className="h-10" />
              </div>

              {/* Owner */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="ownerName" className="text-sm font-medium">
                    <User className="h-3.5 w-3.5 inline mr-1.5" />
                    {ar ? 'اسم المالكة' : 'Owner Name'}
                  </Label>
                  <Input id="ownerName" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                    placeholder={ar ? 'الاسم الكامل' : 'Full Name'} className="h-10" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ownerPhone" className="text-sm font-medium">
                    <Phone className="h-3.5 w-3.5 inline mr-1.5" />
                    {ar ? 'هاتف المالكة' : 'Owner Phone'}
                  </Label>
                  <Input id="ownerPhone" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)}
                    placeholder="+965 9XXX XXXX" className="h-10" dir="ltr" />
                </div>
              </div>

              {/* Branch contact */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="branchPhone" className="text-sm font-medium">
                    <Phone className="h-3.5 w-3.5 inline mr-1.5" />
                    {ar ? 'هاتف الفرع' : 'Branch Phone'}
                    {currentBranch && <span className="text-muted-foreground font-normal ml-1">({currentBranch.name})</span>}
                  </Label>
                  <Input id="branchPhone" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+965 2XXX XXXX" className="h-10" dir="ltr" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="currency" className="text-sm font-medium">
                    {ar ? 'العملة' : 'Currency'}
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency" className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KWD">KWD — Kuwaiti Dinar</SelectItem>
                      <SelectItem value="SAR">SAR — Saudi Riyal</SelectItem>
                      <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                      <SelectItem value="QAR">QAR — Qatari Riyal</SelectItem>
                      <SelectItem value="BHD">BHD — Bahraini Dinar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Address */}
              <div className="grid gap-1.5">
                <Label htmlFor="address" className="text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 inline mr-1.5" />
                  {ar ? 'العنوان' : 'Address'}
                  {currentBranch && <span className="text-muted-foreground font-normal ml-1">({currentBranch.name})</span>}
                </Label>
                <Textarea id="address" value={address} onChange={e => setAddress(e.target.value)}
                  placeholder={ar ? 'عنوان الفرع' : 'Branch address'} rows={2} className="resize-none" />
              </div>

              {/* Tax rate */}
              <div className="grid gap-1.5 max-w-xs">
                <Label htmlFor="taxRate" className="text-sm font-medium">
                  {ar ? 'نسبة الضريبة الافتراضية (%)' : 'Default Tax Rate (%)'}
                </Label>
                <Input id="taxRate" type="number" min="0" max="100" step="0.1"
                  value={taxRate} onChange={e => setTaxRate(e.target.value)} className="h-10" />
                <p className="text-[11px] text-muted-foreground">{ar ? 'الكويت: 0% ضريبة قيمة مضافة' : 'Kuwait: 0% VAT'}</p>
              </div>
            </CardContent>
          </Card>
          <SaveBar tab="business" onSave={handleSaveBusiness} />
        </TabsContent>

        {/* ── Working Hours ── */}
        <TabsContent value="hours" className="space-y-5">
          <Card className="border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{ar ? 'ساعات العمل' : 'Working Hours'}</CardTitle>
              <CardDescription className="text-xs">
                {currentBranch
                  ? (ar ? `إعداد أوقات العمل لـ ${currentBranch.name}` : `Set operating hours for ${currentBranch.name}`)
                  : (ar ? 'ساعات العمل الافتراضية' : 'Default operating hours')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Open / close times */}
              <div>
                <p className="text-sm font-semibold mb-3">{ar ? 'وقت الافتتاح والإغلاق' : 'Opening & Closing Time'}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="openTime" className="text-sm">{ar ? 'وقت الافتتاح' : 'Opening Time'}</Label>
                    <Input id="openTime" type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} className="h-10" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="closeTime" className="text-sm">{ar ? 'وقت الإغلاق' : 'Closing Time'}</Label>
                    <Input id="closeTime" type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} className="h-10" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Working days — real controlled state */}
              <div>
                <p className="text-sm font-semibold mb-3">{ar ? 'أيام العمل الأسبوعية' : 'Weekly Working Days'}</p>
                <div className="space-y-2">
                  {DAYS.map(day => (
                    <div key={day.key}
                      className={cn(
                        'flex items-center justify-between py-3 px-4 rounded-xl border transition-colors',
                        workingDays[day.key]
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border bg-card opacity-60'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={workingDays[day.key] ?? false}
                          onCheckedChange={() => toggleDay(day.key)}
                        />
                        <span className="font-medium text-sm">{ar ? day.ar : day.en}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {workingDays[day.key]
                          ? `${openTime} — ${closeTime}`
                          : (ar ? 'مغلق' : 'Closed')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          <SaveBar tab="hours" onSave={handleSaveHours} />
        </TabsContent>

        {/* ── Channels (WhatsApp pairing) ── */}
        <TabsContent value="channels" className="space-y-5">
          <ChannelsTab ar={ar} />
        </TabsContent>

        {/* ── Notifications ── */}
        <TabsContent value="notifications" className="space-y-5">
          <Card className="border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{ar ? 'تفضيلات الإشعارات' : 'Notification Preferences'}</CardTitle>
              <CardDescription className="text-xs">{ar ? 'إدارة كيفية تلقي الإشعارات' : 'Manage how you receive notifications'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                {
                  label:  { en: 'Email Notifications',    ar: 'إشعارات البريد الإلكتروني' },
                  desc:   { en: 'Receive booking updates via email', ar: 'تلقي تحديثات الحجوزات عبر البريد' },
                  val: emailNotif, set: setEmailNotif,
                },
                {
                  label:  { en: 'SMS Notifications',      ar: 'إشعارات الرسائل النصية' },
                  desc:   { en: 'Receive important alerts via SMS', ar: 'تلقي تنبيهات مهمة عبر الرسائل' },
                  val: smsNotif, set: setSmsNotif,
                },
                {
                  label:  { en: 'Booking Reminders',      ar: 'تذكيرات الحجوزات' },
                  desc:   { en: 'Send reminders to clients before appointments', ar: 'إرسال تذكيرات للعميلات قبل مواعيدهن' },
                  val: bookingReminders, set: setBookingReminders,
                },
                {
                  label:  { en: 'Marketing Emails',       ar: 'بريد تسويقي' },
                  desc:   { en: 'Receive product updates and promotions', ar: 'تلقي تحديثات المنتجات والعروض' },
                  val: marketingEmails, set: setMarketingEmails,
                },
              ].map(({ label, desc, val, set }, i) => (
                <div key={label.en}>
                  {i > 0 && <Separator className="my-1" />}
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{ar ? label.ar : label.en}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ar ? desc.ar : desc.en}</p>
                    </div>
                    <Switch checked={val} onCheckedChange={set} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <SaveBar tab="notifications" onSave={handleSaveNotifications} />
        </TabsContent>

        {/* ── Preferences ── */}
        <TabsContent value="preferences" className="space-y-5">
          <Card className="border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{ar ? 'الإعدادات الإقليمية' : 'Regional & Display'}</CardTitle>
              <CardDescription className="text-xs">{ar ? 'تخصيص إعدادات الصالون الإقليمية' : "Customize your salon's regional settings"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-sm font-medium">{ar ? 'العملة' : 'Currency'}</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KWD">KWD — Kuwaiti Dinar</SelectItem>
                      <SelectItem value="SAR">SAR — Saudi Riyal</SelectItem>
                      <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                      <SelectItem value="QAR">QAR — Qatari Riyal</SelectItem>
                      <SelectItem value="BHD">BHD — Bahraini Dinar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-medium">{ar ? 'المنطقة الزمنية' : 'Timezone'}</Label>
                  <Select defaultValue="Asia/Kuwait">
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kuwait">Asia/Kuwait (GMT+3)</SelectItem>
                      <SelectItem value="Asia/Riyadh">Asia/Riyadh (GMT+3)</SelectItem>
                      <SelectItem value="Asia/Dubai">Asia/Dubai (GMT+4)</SelectItem>
                      <SelectItem value="Asia/Qatar">Asia/Qatar (GMT+3)</SelectItem>
                      <SelectItem value="Asia/Bahrain">Asia/Bahrain (GMT+3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                {ar
                  ? 'ملاحظة: تغيير العملة هنا يؤثر على عرض المبالغ في جميع أنحاء النظام. لا يغير المبالغ المحفوظة في قاعدة البيانات.'
                  : 'Note: Changing currency affects how amounts are displayed throughout the system. It does not convert existing amounts in the database.'}
              </div>
            </CardContent>
          </Card>
          <SaveBar tab="preferences" onSave={handleSavePreferences} />
        </TabsContent>

        {/* ── Online Booking Config ── */}
        <TabsContent value="booking" className="space-y-5">
          <OnlineBookingConfig ar={ar} tenantId={tenant?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Online Booking Config component ──────────────────────────
function OnlineBookingConfig({ ar, tenantId }: { ar: boolean; tenantId?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['booking-config', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('booking_config').select('id, tenant_id, slug, header_title, header_title_ar, welcome_msg, welcome_msg_ar, show_prices, show_staff, advance_booking_days, min_notice_hours, primary_color').eq('tenant_id', tenantId!).maybeSingle();
      return data as any;
    },
    enabled: !!tenantId,
  });

  const [enabled,        setEnabled]        = useState(true);
  const [slug,           setSlug]           = useState('');
  const [headerTitle,    setHeaderTitle]    = useState('');
  const [welcomeMsg,     setWelcomeMsg]     = useState('');
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [depositPct,     setDepositPct]     = useState('25');
  const [advanceDays,    setAdvanceDays]    = useState('30');
  const [minNotice,      setMinNotice]      = useState('2');
  const [showPrices,     setShowPrices]     = useState(true);
  const [showStaff,      setShowStaff]      = useState(true);
  const [inited,         setInited]         = useState(false);
  const [saving,         setSaving]         = useState(false);

  if (config && !inited) {
    setEnabled(config.is_enabled ?? true);
    setSlug(config.slug || '');
    setHeaderTitle(config.header_title || '');
    setWelcomeMsg(config.welcome_msg || '');
    setRequireDeposit(config.require_deposit ?? false);
    setDepositPct(String(config.deposit_pct || 25));
    setAdvanceDays(String(config.advance_booking_days || 30));
    setMinNotice(String(config.min_notice_hours || 2));
    setShowPrices(config.show_prices ?? true);
    setShowStaff(config.show_staff ?? true);
    setInited(true);
  }

  const bookingUrl = slug
    ? `${window.location.origin}/book?slug=${slug}`
    : `${window.location.origin}/book?tenant=${tenantId}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        tenant_id:             tenantId,
        is_enabled:            enabled,
        slug:                  slug.trim().toLowerCase().replace(/\s+/g, '-') || null,
        header_title:          headerTitle || null,
        welcome_msg:           welcomeMsg || null,
        require_deposit:       requireDeposit,
        deposit_pct:           Number(depositPct),
        advance_booking_days:  Number(advanceDays),
        min_notice_hours:      Number(minNotice),
        show_prices:           showPrices,
        show_staff:            showStaff,
      };
      if (config?.id) {
        await supabase.from('booking_config').update(payload).eq('id', config.id);
      } else {
        await supabase.from('booking_config').insert(payload);
      }
      qc.invalidateQueries({ queryKey: ['booking-config'] });
      toast({ title: '✅ Booking settings saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <Skeleton className="h-64 w-full rounded-md"/>;

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Enable toggle */}
      <Card className="border">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{ar?'الحجز الإلكتروني':'Online Booking'}</p>
            <p className="text-xs text-muted-foreground">{ar?'السماح للعميلات بالحجز عبر الإنترنت':'Allow clients to book appointments online'}</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled}/>
        </CardContent>
      </Card>

      {/* Booking link */}
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{ar?'رابط الحجز':'Booking Link'}</p>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{ar?'الرابط المخصص (slug)':'Custom Slug'}</Label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 px-3 py-2 rounded-md border bg-muted/40 text-xs text-muted-foreground flex-shrink-0">
                /book?slug=
              </div>
              <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
                className="h-9 font-mono flex-1" placeholder="my-salon"/>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/40">
            <p className="text-[11px] font-mono truncate flex-1 text-muted-foreground">{bookingUrl}</p>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0" onClick={copyUrl}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500"/> : <Copy className="h-3.5 w-3.5"/>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Behaviour */}
      <Card className="border">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{ar?'سلوك الحجز':'Booking Behaviour'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar?'الحجز المسبق (أيام)':'Advance booking (days)'}</Label>
              <Input type="number" min="1" max="365" value={advanceDays} onChange={e => setAdvanceDays(e.target.value)} className="h-9"/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar?'الحد الأدنى للإشعار (ساعات)':'Min notice (hours)'}</Label>
              <Input type="number" min="0" max="72" value={minNotice} onChange={e => setMinNotice(e.target.value)} className="h-9"/>
            </div>
          </div>
          <Separator/>
          {[
            { label: ar?'عرض الأسعار':'Show prices', val: showPrices, set: setShowPrices },
            { label: ar?'عرض الموظفات':'Show stylists', val: showStaff, set: setShowStaff },
            { label: ar?'عربون إلزامي':'Require deposit for all', val: requireDeposit, set: setRequireDeposit },
          ].map(({ label, val, set }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <Switch checked={val} onCheckedChange={set}/>
            </div>
          ))}
          {requireDeposit && (
            <div className="space-y-1.5 pl-4 border-l-2 border-primary/20">
              <Label className="text-xs font-semibold">{ar?'نسبة العربون (%)':'Deposit %'}</Label>
              <Input type="number" min="1" max="100" value={depositPct} onChange={e => setDepositPct(e.target.value)} className="h-9 w-32"/>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom text */}
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{ar?'نصوص مخصصة':'Custom Text'}</p>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{ar?'عنوان الصفحة':'Page Header Title'}</Label>
            <Input value={headerTitle} onChange={e => setHeaderTitle(e.target.value)} className="h-9" placeholder="Book Your Appointment"/>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{ar?'رسالة الترحيب':'Welcome Message'}</Label>
            <Textarea value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)} rows={2} className="resize-none text-sm"
              placeholder="Welcome! We look forward to seeing you."/>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gap-1.5">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>}
        {ar?'حفظ إعدادات الحجز':'Save Booking Settings'}
      </Button>
    </div>
  );
}

/**
 * D.8 — Channels tab component.
 *
 * Single-channel UI for now (WhatsApp).  Future-proofed for IG /
 * Telegram by reading the channel from useChannelAccounts; the
 * shape is identical, just the labels change.
 *
 * Three states:
 *   - never connected    → big CTA to start pairing
 *   - pending (QR shown) → render QR + instructions, poll for
 *                          status flip to 'connected'
 *   - connected          → show paired phone number, last sync,
 *                          AI/auto-reply toggles, disconnect button
 *   - disconnected/error → show last_error if present, prominent
 *                          re-pair button.  This is the state the
 *                          global banner sends users into.
 */
function ChannelsTab({ ar }: { ar: boolean }) {
  const { account, qrCode, loading, actionLoading, error, connect, disconnect } =
    useChannelAccounts('whatsapp');

  if (loading) {
    return (
      <Card className="border">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const status = account?.status ?? 'disconnected';
  const isConnected = status === 'connected';
  const isPending   = status === 'pending';
  const isUnhealthy = status === 'disconnected' || status === 'error' || status === 'expired';

  return (
    <Card className="border">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          {ar ? 'واتساب' : 'WhatsApp'}
        </CardTitle>
        <CardDescription className="text-xs">
          {ar
            ? 'اربط واتساب صالونك لإرسال التذكيرات والفواتير والرد التلقائي بالذكاء الاصطناعي'
            : 'Pair your salon\'s WhatsApp for reminders, invoices, and AI auto-replies'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Status row */}
        <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
          <div className={cn(
            'h-2.5 w-2.5 rounded-full flex-shrink-0',
            isConnected ? 'bg-emerald-500' :
            isPending   ? 'bg-amber-500 animate-pulse' :
                          'bg-red-500',
          )} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {isConnected ? (ar ? 'متصل' : 'Connected') :
               isPending   ? (ar ? 'بانتظار المسح…' : 'Waiting for QR scan…') :
               status === 'expired' ? (ar ? 'انتهت الجلسة' : 'Session expired') :
               status === 'error'   ? (ar ? 'خطأ في الاتصال' : 'Connection error') :
                                      (ar ? 'غير متصل' : 'Not connected')}
            </p>
            {account?.display_handle && (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {account.display_handle}
                {account.last_sync_at && (
                  <span className="ms-2 opacity-70">
                    · {ar ? 'آخر نشاط:' : 'last seen:'}{' '}
                    {new Date(account.last_sync_at).toLocaleString()}
                  </span>
                )}
              </p>
            )}
            {!account?.display_handle && account?.connected_at && (
              <p className="text-[11px] text-muted-foreground">
                {ar ? 'تم الربط في: ' : 'Paired: '}
                {new Date(account.connected_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Last error — only when present and status is unhealthy.
            Bridge writes free-form strings here; useful for diagnosis
            when a re-pair fails repeatedly (e.g. 'pre-key failed'). */}
        {isUnhealthy && account?.last_error && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold">{ar ? 'سبب فشل الاتصال' : 'Last error'}</p>
              <p className="opacity-80 break-all">{account.last_error}</p>
            </div>
          </div>
        )}

        {/* QR code while pairing.  qrCode is a data URL the bridge
            generated for this exact session. */}
        {isPending && qrCode && (
          <div className="space-y-3">
            <div className="flex justify-center p-4 bg-white rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="WhatsApp pairing QR" className="w-64 h-64" />
            </div>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal ms-5">
              <li>{ar ? 'افتح واتساب على هاتفك' : 'Open WhatsApp on your phone'}</li>
              <li>{ar ? 'اذهب إلى الإعدادات ← الأجهزة المرتبطة' : 'Go to Settings → Linked Devices'}</li>
              <li>{ar ? 'اضغط على "ربط جهاز"' : 'Tap "Link a device"'}</li>
              <li>{ar ? 'امسح هذا الرمز' : 'Scan this code'}</li>
            </ol>
            <p className="text-[10px] text-muted-foreground text-center">
              {ar
                ? 'الرمز ينتهي خلال دقيقة — إذا انتهى اضغط "إعادة الربط" مرة أخرى'
                : 'QR expires in ~1 min — click Re-pair if it does'}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {!isConnected && (
            <Button
              onClick={connect}
              disabled={actionLoading}
              className="gap-2"
            >
              {actionLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : isPending ? <RefreshCw className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
              {isPending
                ? (ar ? 'إعادة الرمز' : 'Refresh QR')
                : isUnhealthy && account?.connected_at
                  ? (ar ? 'إعادة الربط' : 'Re-pair WhatsApp')
                  : (ar ? 'ربط واتساب' : 'Connect WhatsApp')}
            </Button>
          )}
          {(isConnected || isPending) && (
            <Button
              variant="outline"
              onClick={disconnect}
              disabled={actionLoading}
              className="gap-2"
            >
              {actionLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Power className="h-4 w-4" />}
              {ar ? 'فصل' : 'Disconnect'}
            </Button>
          )}
        </div>

        {/* Inline action error */}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Per-account toggles — only show when actually paired so we
            don't surface settings the user can't act on. */}
        {isConnected && account && (
          <div className="space-y-3 pt-3 border-t">
            <ChannelToggle
              accountId={account.id}
              field="ai_agent_enabled"
              value={account.ai_agent_enabled}
              label={ar ? 'الرد بالذكاء الاصطناعي' : 'AI auto-reply'}
              hint={ar
                ? 'يرد الذكاء الاصطناعي على رسائل العملاء تلقائياً (يمكن التعديل لكل محادثة من البريد الوارد)'
                : 'AI responds to client messages automatically (override per-conversation in the inbox)'}
            />
            <ChannelToggle
              accountId={account.id}
              field="auto_reply_enabled"
              value={account.auto_reply_enabled}
              label={ar ? 'الرد التلقائي خارج ساعات العمل' : 'Off-hours auto-reply'}
              hint={ar
                ? 'إرسال رد آلي عندما تتلقى رسالة خارج ساعات العمل'
                : 'Send an automated reply when messages arrive outside business hours'}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Reusable on/off row for a channel_accounts boolean field.
 * Optimistic update — flip locally, persist, revert on error.
 */
function ChannelToggle({
  accountId, field, value, label, hint,
}: {
  accountId: string;
  field: 'ai_agent_enabled' | 'auto_reply_enabled';
  value: boolean;
  label: string;
  hint: string;
}) {
  const [optimistic, setOptimistic] = useState(value);
  const [saving, setSaving] = useState(false);
  const handleToggle = async (next: boolean) => {
    setOptimistic(next);
    setSaving(true);
    const { error } = await supabase
      .from('channel_accounts')
      .update({ [field]: next } as any)
      .eq('id', accountId);
    if (error) {
      setOptimistic(!next); // revert
    }
    setSaving(false);
  };
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <div className="pt-0.5">
        {saving
          ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          : <Switch checked={optimistic} onCheckedChange={handleToggle} />}
      </div>
    </div>
  );
}
