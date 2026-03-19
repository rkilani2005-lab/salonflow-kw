import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, MapPin, User, Check, Sparkles, ArrowRight, ArrowLeft, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

const STEPS = [
  { id: 1, title: 'Salon Details',  titleAr: 'تفاصيل الصالون', icon: Building2, desc: 'Tell us about your business', descAr: 'أخبرينا عن عملك' },
  { id: 2, title: 'First Branch',   titleAr: 'الفرع الأول',    icon: MapPin,     desc: 'Set up your main location', descAr: 'أعدّي موقعك الرئيسي' },
  { id: 3, title: 'First Staff',    titleAr: 'أول موظفة',       icon: User,       desc: 'Add your first team member', descAr: 'أضيفي أول عضو في الفريق' },
];

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [salon, setSalon] = useState({ name: '', defaultTaxRate: '0', currency: 'KWD' });
  const [branch, setBranch] = useState({ name: 'Main Branch', address: '', phone: '', openingTime: '09:00', closingTime: '21:00' });
  const [staff, setStaff] = useState({ name: '', phone: '', email: '' });

  const canProceed = () => {
    if (step === 1) return salon.name.trim().length >= 2;
    if (step === 2) return branch.name.trim().length >= 2;
    if (step === 3) return staff.name.trim().length >= 2;
    return false;
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({ name: salon.name.trim(), default_tax_rate: parseFloat(salon.defaultTaxRate) || 0, currency: salon.currency, onboarding_completed: true, is_trial: true, trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString() })
        .select().single();
      if (tenantError) throw tenantError;

      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .insert({ tenant_id: tenantData.id, name: branch.name.trim(), address: branch.address, phone: branch.phone, opening_time: branch.openingTime + ':00', closing_time: branch.closingTime + ':00', is_active: true })
        .select().single();
      if (branchError) throw branchError;

      await supabase.from('profiles').update({ tenant_id: tenantData.id, branch_id: branchData.id }).eq('user_id', user.id);
      await supabase.from('user_roles').insert({ user_id: user.id, tenant_id: tenantData.id, role: 'owner' });

      if (staff.name.trim()) {
        await supabase.from('staff').insert({ tenant_id: tenantData.id, name: staff.name.trim(), phone: staff.phone, email: staff.email, working_hours_start: branch.openingTime + ':00', working_hours_end: branch.closingTime + ':00', is_active: true });
      }

      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#C0395E', '#D4956A', '#ffffff'] });
      await refreshProfile();
      toast.success('Welcome to ZAINA! 🎉');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border/60 flex items-center px-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Scissors className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>ZAINA Setup</span>
        </div>
        <div className="ml-auto text-xs text-muted-foreground font-medium">Step {step} of {STEPS.length}</div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">

          {/* Progress bar */}
          <div className="mb-8">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress + 50}%` }} />
            </div>
            {/* Step dots */}
            <div className="flex justify-between mt-3">
              {STEPS.map(s => {
                const Icon = s.icon;
                const done = step > s.id;
                const active = step === s.id;
                return (
                  <div key={s.id} className="flex flex-col items-center gap-1.5">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300',
                      done ? 'bg-primary text-primary-foreground' :
                      active ? 'bg-primary/15 text-primary ring-2 ring-primary/30' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={cn('text-[10px] font-medium hidden sm:block', active ? 'text-primary' : 'text-muted-foreground')}>
                      {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card */}
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
            {/* Step header */}
            <div className="px-6 pt-6 pb-5 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {(() => { const Icon = STEPS[step-1].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>{STEPS[step-1].title}</h2>
                  <p className="text-sm text-muted-foreground">{STEPS[step-1].desc}</p>
                </div>
              </div>
            </div>

            {/* Step content */}
            <div className="p-6 space-y-4">
              {/* Step 1: Salon Details */}
              {step === 1 && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="salonName">Salon Name *</Label>
                    <Input id="salonName" placeholder="e.g., Glam Studio Kuwait" value={salon.name}
                      onChange={e => setSalon({ ...salon, name: e.target.value })} className="h-10" autoFocus />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="currency">Currency</Label>
                      <select id="currency" value={salon.currency} onChange={e => setSalon({ ...salon, currency: e.target.value })}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                        <option value="KWD">KWD - Kuwaiti Dinar</option>
                        <option value="SAR">SAR - Saudi Riyal</option>
                        <option value="AED">AED - UAE Dirham</option>
                        <option value="QAR">QAR - Qatari Riyal</option>
                        <option value="BHD">BHD - Bahraini Dinar</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="taxRate">Tax Rate (%)</Label>
                      <Input id="taxRate" type="number" min="0" max="30" step="0.1" placeholder="0"
                        value={salon.defaultTaxRate} onChange={e => setSalon({ ...salon, defaultTaxRate: e.target.value })} className="h-10" />
                      <p className="text-[11px] text-muted-foreground">Kuwait: 0% VAT</p>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Branch */}
              {step === 2 && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="branchName">Branch Name *</Label>
                    <Input id="branchName" placeholder="e.g., Salmiya Branch" value={branch.name}
                      onChange={e => setBranch({ ...branch, name: e.target.value })} className="h-10" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branchAddress">Address</Label>
                    <Input id="branchAddress" placeholder="Block 5, Street 10, Salmiya, Kuwait" value={branch.address}
                      onChange={e => setBranch({ ...branch, address: e.target.value })} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branchPhone">Branch Phone</Label>
                    <Input id="branchPhone" placeholder="+965 9XXX XXXX" value={branch.phone}
                      onChange={e => setBranch({ ...branch, phone: e.target.value })} className="h-10" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="openTime">Opening Time</Label>
                      <Input id="openTime" type="time" value={branch.openingTime}
                        onChange={e => setBranch({ ...branch, openingTime: e.target.value })} className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="closeTime">Closing Time</Label>
                      <Input id="closeTime" type="time" value={branch.closingTime}
                        onChange={e => setBranch({ ...branch, closingTime: e.target.value })} className="h-10" />
                    </div>
                  </div>
                </>
              )}

              {/* Step 3: Staff */}
              {step === 3 && (
                <>
                  <div className="p-3 rounded-xl bg-primary/6 border border-primary/20 text-sm text-primary mb-2">
                    💡 Add your first stylist — you can add more from the Staff page anytime.
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="staffName">Staff Name *</Label>
                    <Input id="staffName" placeholder="e.g., Fatima Al-Sabah" value={staff.name}
                      onChange={e => setStaff({ ...staff, name: e.target.value })} className="h-10" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="staffPhone">Phone (optional)</Label>
                    <Input id="staffPhone" placeholder="+965 9XXX XXXX" value={staff.phone}
                      onChange={e => setStaff({ ...staff, phone: e.target.value })} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="staffEmail">Email (optional)</Label>
                    <Input id="staffEmail" type="email" placeholder="staff@salon.com" value={staff.email}
                      onChange={e => setStaff({ ...staff, email: e.target.value })} className="h-10" />
                  </div>
                </>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} disabled={step === 1} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />Back
              </Button>
              {step < STEPS.length ? (
                <Button size="sm" onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="gap-1.5">
                  Next<ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" onClick={handleComplete} disabled={!canProceed() || loading} className="gap-1.5">
                  {loading
                    ? <><span className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />Setting up...</>
                    : <><Sparkles className="h-3.5 w-3.5" />Launch Dashboard</>
                  }
                </Button>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Your 14-day free trial starts now · No credit card required
          </p>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
