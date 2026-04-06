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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Edit2, Trash2, Calendar, Clock, Tag,
  CheckCircle2, Loader2, AlertTriangle, TrendingDown, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isAfter, isBefore, parseISO } from 'date-fns';

interface PriceSchedule {
  id:         string;
  service_id: string;
  tenant_id:  string;
  label:      string;
  price:      number;
  valid_from: string;
  valid_to:   string;
  is_active:  boolean;
  created_at: string;
}

interface Props {
  serviceId:  string;
  basePrice:  number;
  currency?:  string;
}

// Convert datetime-local value to ISO string
const toISO = (local: string) => local ? new Date(local).toISOString() : '';
// Convert ISO to datetime-local input value
const toLocal = (iso: string) => iso ? iso.slice(0, 16) : '';

function scheduleStatus(s: PriceSchedule): 'active' | 'upcoming' | 'expired' | 'inactive' {
  if (!s.is_active) return 'inactive';
  const now = new Date();
  const from = parseISO(s.valid_from);
  const to   = parseISO(s.valid_to);
  if (isBefore(now, from)) return 'upcoming';
  if (isAfter(now, to))    return 'expired';
  return 'active';
}

const STATUS_CONFIG = {
  active:   { label: 'Active now',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' },
  upcoming: { label: 'Upcoming',    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400' },
  expired:  { label: 'Expired',     color: 'bg-muted text-muted-foreground border-border' },
  inactive: { label: 'Disabled',    color: 'bg-muted text-muted-foreground border-border' },
};

export function ServicePriceSchedules({ serviceId, basePrice, currency = 'KWD' }: Props) {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing,    setEditing]    = useState<PriceSchedule | null>(null);

  // Form state
  const [label,     setLabel]     = useState('');
  const [price,     setPrice]     = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo,   setValidTo]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  // ── Load schedules ──────────────────────────────────────────
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['price-schedules', serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_price_schedules')
        .select('*')
        .eq('service_id', serviceId)
        .order('valid_from', { ascending: false });
      if (error) throw error;
      return data as PriceSchedule[];
    },
    enabled: !!serviceId,
  });

  // ── Effective price right now ───────────────────────────────
  const now = new Date();
  const activeSchedule = schedules.find(s => scheduleStatus(s) === 'active');
  const effectivePrice = activeSchedule ? activeSchedule.price : basePrice;
  const hasPriceChange = activeSchedule && activeSchedule.price !== basePrice;

  // ── Open dialog ─────────────────────────────────────────────
  const openNew = () => {
    setEditing(null);
    setLabel('');
    setPrice(basePrice.toFixed(3));
    // Default: starts now, ends in 7 days
    const from = new Date();
    const to   = new Date(from.getTime() + 7 * 86400000);
    setValidFrom(from.toISOString().slice(0, 16));
    setValidTo(to.toISOString().slice(0, 16));
    setDialogOpen(true);
  };

  const openEdit = (s: PriceSchedule) => {
    setEditing(s);
    setLabel(s.label);
    setPrice(Number(s.price).toFixed(3));
    setValidFrom(toLocal(s.valid_from));
    setValidTo(toLocal(s.valid_to));
    setDialogOpen(true);
  };

  // ── Save ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!label.trim() || !price || !validFrom || !validTo) {
      toast({ title: 'All fields are required', variant: 'destructive' });
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast({ title: 'Enter a valid price', variant: 'destructive' });
      return;
    }
    if (new Date(validTo) <= new Date(validFrom)) {
      toast({ title: 'End date must be after start date', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        service_id: serviceId,
        tenant_id:  tenant!.id,
        label:      label.trim(),
        price:      priceNum,
        valid_from: new Date(validFrom).toISOString(),
        valid_to:   new Date(validTo).toISOString(),
        is_active:  true,
      };

      if (editing) {
        const { error } = await supabase
          .from('service_price_schedules')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: '✅ Price schedule updated' });
      } else {
        const { error } = await supabase
          .from('service_price_schedules')
          .insert(payload);
        if (error) throw error;
        toast({ title: '✅ Price schedule created' });
      }

      qc.invalidateQueries({ queryKey: ['price-schedules', serviceId] });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ───────────────────────────────────────────
  const handleToggle = async (s: PriceSchedule) => {
    await supabase
      .from('service_price_schedules')
      .update({ is_active: !s.is_active })
      .eq('id', s.id);
    qc.invalidateQueries({ queryKey: ['price-schedules', serviceId] });
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from('service_price_schedules').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['price-schedules', serviceId] });
    setDeleting(null);
    toast({ title: 'Price schedule deleted' });
  };

  const fmt = (n: number) => `${Number(n).toFixed(3)} ${currency}`;
  const fmtDate = (iso: string) => format(parseISO(iso), 'EEE, MMM d yyyy · HH:mm');

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Effective price banner */}
      <div className={cn(
        'flex items-center justify-between p-3.5 rounded-md border',
        hasPriceChange
          ? 'bg-primary/5 border-primary/20'
          : 'bg-muted/30 border-border'
      )}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-0.5">
            Effective Price Right Now
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black stat-number text-foreground">
              {fmt(effectivePrice)}
            </span>
            {hasPriceChange && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {activeSchedule.price < basePrice
                  ? <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                  : <TrendingUp className="h-3.5 w-3.5 text-red-500" />}
                <span>base: {fmt(basePrice)}</span>
              </div>
            )}
          </div>
          {activeSchedule && (
            <p className="text-[11px] text-primary mt-0.5 font-medium">
              {activeSchedule.label} · ends {fmtDate(activeSchedule.valid_to)}
            </p>
          )}
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5 h-8 text-xs flex-shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Add Schedule
        </Button>
      </div>

      {/* Schedules list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center text-muted-foreground gap-2">
          <Calendar className="h-7 w-7 opacity-30" />
          <p className="text-sm font-medium">No price schedules yet</p>
          <p className="text-xs opacity-60">
            Add a schedule to set a different price for a specific date range —
            perfect for Eid offers, weekday rates, or peak season pricing.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map(s => {
            const st = scheduleStatus(s);
            const cfg = STATUS_CONFIG[st];
            return (
              <div
                key={s.id}
                className={cn(
                  'border rounded-md p-4 transition-opacity',
                  st === 'expired' || st === 'inactive' ? 'opacity-55' : 'opacity-100'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <p className="text-sm font-semibold">{s.label}</p>
                      <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-sm font-bold border', cfg.color)}>
                        {cfg.label}
                      </Badge>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-black stat-number">{fmt(s.price)}</span>
                      {s.price !== basePrice && (
                        <span className={cn('text-xs font-semibold', s.price < basePrice ? 'text-emerald-600' : 'text-red-500')}>
                          {s.price < basePrice ? '▼' : '▲'} {Math.abs(((s.price - basePrice) / basePrice) * 100).toFixed(0)}%
                          {' '}from base
                        </span>
                      )}
                    </div>

                    {/* Window */}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span>{fmtDate(s.valid_from)}</span>
                      <span className="font-bold">→</span>
                      <span>{fmtDate(s.valid_to)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={() => handleToggle(s)}
                      className="scale-75"
                    />
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground"
                      onClick={() => openEdit(s)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/8"
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                    >
                      {deleting === s.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="h-7 w-7 rounded-sm bg-primary/10 flex items-center justify-center">
                <Tag className="h-3.5 w-3.5 text-primary" />
              </div>
              {editing ? 'Edit Price Schedule' : 'New Price Schedule'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Label */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Label *</Label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Eid Special, Weekend Rate, Summer Promo"
                className="h-10"
                autoFocus
              />
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Price ({currency}) *</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="h-10 pr-14"
                  placeholder="0.000"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  {currency}
                </span>
              </div>
              {price && !isNaN(parseFloat(price)) && (
                <p className={cn(
                  'text-xs font-medium',
                  parseFloat(price) < basePrice ? 'text-emerald-600' :
                  parseFloat(price) > basePrice ? 'text-red-500' : 'text-muted-foreground'
                )}>
                  {parseFloat(price) < basePrice
                    ? `↓ ${(basePrice - parseFloat(price)).toFixed(3)} ${currency} less than base price`
                    : parseFloat(price) > basePrice
                    ? `↑ ${(parseFloat(price) - basePrice).toFixed(3)} ${currency} more than base price`
                    : 'Same as base price'}
                </p>
              )}
            </div>

            <Separator />

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Start *
                </Label>
                <Input
                  type="datetime-local"
                  value={validFrom}
                  onChange={e => setValidFrom(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3" /> End *
                </Label>
                <Input
                  type="datetime-local"
                  value={validTo}
                  onChange={e => setValidTo(e.target.value)}
                  className="h-10 text-xs"
                  min={validFrom}
                />
              </div>
            </div>

            {/* Duration preview */}
            {validFrom && validTo && new Date(validTo) > new Date(validFrom) && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/40 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                <span>
                  Active from <strong>{format(new Date(validFrom), 'MMM d, HH:mm')}</strong>
                  {' '}to <strong>{format(new Date(validTo), 'MMM d, HH:mm')}</strong>
                  {' '}({Math.round((new Date(validTo).getTime() - new Date(validFrom).getTime()) / 86400000)} days)
                </span>
              </div>
            )}
            {validFrom && validTo && new Date(validTo) <= new Date(validFrom) && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/8 border border-destructive/20 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                End date must be after start date
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 min-w-[110px]">
              {saving
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? 'Saving...' : editing ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
