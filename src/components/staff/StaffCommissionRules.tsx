import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';

// Cast to any to support tables not yet reflected in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Edit2, Trash2, Percent, Banknote, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: '__default__',   label: 'All Services (Default)' },
  { value: 'hair',          label: '✂️ Hair' },
  { value: 'nails',         label: '💅 Nails' },
  { value: 'facial',        label: '🧖 Facial' },
  { value: 'makeup',        label: '💄 Makeup' },
  { value: 'waxing',        label: '🪒 Waxing' },
  { value: 'massage',       label: '💆 Massage' },
  { value: 'other',         label: '✨ Other' },
];

interface Rule {
  id: string;
  service_category: string | null;
  commission_type: string;
  commission_value: number;
  is_active: boolean;
}

export function StaffCommissionRules({ staffId, staffName, currency = 'KWD' }: {
  staffId: string; staffName: string; currency?: string;
}) {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [cat,     setCat]     = useState('__default__');
  const [type,    setType]    = useState<'percentage'|'flat'>('percentage');
  const [value,   setValue]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [deleting,setDeleting]= useState<string|null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['commission-rules', staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_commission_rules')
        .select('*')
        .eq('staff_id', staffId)
        .order('service_category', { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data as Rule[];
    },
    enabled: !!staffId,
  });

  const openNew = () => {
    setEditing(null);
    setCat('__default__');
    setType('percentage');
    setValue('');
    setOpen(true);
  };
  const openEdit = (r: Rule) => {
    setEditing(r);
    setCat(r.service_category ?? '__default__');
    setType(r.commission_type as any);
    setValue(String(r.commission_value));
    setOpen(true);
  };

  const handleSave = async () => {
    const v = parseFloat(value);
    if (isNaN(v) || v < 0) { toast({ title: 'Enter a valid value', variant: 'destructive' }); return; }
    if (type === 'percentage' && v > 100) { toast({ title: 'Percentage cannot exceed 100%', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const payload = {
        staff_id:         staffId,
        tenant_id:        tenant!.id,
        service_category: cat === '__default__' ? null : cat,
        commission_type:  type,
        commission_value: v,
        is_active:        true,
      };

      if (editing) {
        const { error } = await supabase.from('staff_commission_rules').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('staff_commission_rules').insert(payload);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ['commission-rules', staffId] });
      toast({ title: editing ? '✅ Rule updated' : '✅ Commission rule created' });
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from('staff_commission_rules').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['commission-rules', staffId] });
    setDeleting(null);
    toast({ title: 'Rule deleted' });
  };

  const handleToggle = async (r: Rule) => {
    await supabase.from('staff_commission_rules').update({ is_active: !r.is_active }).eq('id', r.id);
    qc.invalidateQueries({ queryKey: ['commission-rules', staffId] });
  };

  const catLabel = (cat: string | null) =>
    CATEGORIES.find(c => c.value === (cat ?? '__default__'))?.label ?? cat ?? 'All';

  const totalEst = rules.filter(r => r.is_active && r.commission_type === 'percentage')
    .reduce((s, r) => s + r.commission_value, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            Commission Rules
          </p>
          {rules.filter(r => r.is_active).length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {rules.filter(r => r.is_active).length} active rule{rules.filter(r => r.is_active).length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={openNew} className="h-7 gap-1.5 text-xs">
          <Plus className="h-3 w-3" />Add Rule
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}</div>
      ) : rules.length === 0 ? (
        <div className="border border-dashed rounded-md p-4 text-center text-xs text-muted-foreground">
          No commission rules set. Add a rule to start tracking {staffName}'s earnings.
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden divide-y divide-border">
          {rules.map(r => (
            <div key={r.id} className={cn('flex items-center gap-3 px-4 py-3 bg-card', !r.is_active && 'opacity-50')}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{catLabel(r.service_category)}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {r.commission_type === 'percentage'
                    ? <><Percent className="h-3 w-3 text-primary" /><span className="text-sm font-black stat-number text-primary">{r.commission_value}%</span></>
                    : <><Banknote className="h-3 w-3 text-amber-600" /><span className="text-sm font-black stat-number text-amber-600">{r.commission_value.toFixed(3)} {currency}</span></>
                  }
                  <span className="text-[10px] text-muted-foreground">per service</span>
                </div>
              </div>
              <Switch checked={r.is_active} onCheckedChange={() => handleToggle(r)} className="scale-75" />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground"
                onClick={() => openEdit(r)}><Edit2 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/8"
                onClick={() => handleDelete(r.id)} disabled={deleting === r.id}>
                {deleting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Rule dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{editing ? 'Edit Commission Rule' : 'Add Commission Rule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Applies to</Label>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Commission Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {[{ v: 'percentage', label: '% Percentage', icon: Percent }, { v: 'flat', label: `Flat ${currency}`, icon: Banknote }].map(opt => (
                  <button key={opt.v} onClick={() => setType(opt.v as any)}
                    className={cn('flex items-center gap-2 p-3 rounded-md border text-sm font-medium transition-all',
                      type === opt.v ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                    <opt.icon className="h-4 w-4" />{opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {type === 'percentage' ? 'Commission Rate (%)' : `Commission Amount (${currency})`}
              </Label>
              <div className="relative">
                <Input type="number" step={type === 'percentage' ? '0.5' : '0.001'} min="0"
                  max={type === 'percentage' ? '100' : undefined}
                  value={value} onChange={e => setValue(e.target.value)} className="h-10 pr-10" placeholder="0" autoFocus />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  {type === 'percentage' ? '%' : currency}
                </span>
              </div>
              {value && !isNaN(parseFloat(value)) && type === 'percentage' && (
                <p className="text-[11px] text-muted-foreground">
                  On a 20.000 {currency} service → earns <strong>{(20 * parseFloat(value) / 100).toFixed(3)} {currency}</strong>
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !value} className="gap-1.5 min-w-[100px]">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {saving ? 'Saving...' : editing ? 'Update' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
