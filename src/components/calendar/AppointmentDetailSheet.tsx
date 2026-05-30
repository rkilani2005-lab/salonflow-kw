import { useState, useEffect, useRef } from 'react';
import { ProductSearch } from '@/components/pos/ProductSearch';
import type { CartItem } from '@/hooks/useTransactions';
import { supabase as _supabaseRaw } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabaseRaw as any;
import { Appointment, Staff, Service, Client, AppointmentStatus, SERVICE_CATEGORY_COLORS } from '@/types/calendar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Clock,
  User,
  Users,
  Scissors,
  CreditCard,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  FlaskConical,
  Save as SaveIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBookingPayment } from '@/hooks/useBookingPayment';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const statusLabels: Record<AppointmentStatus, string> = {
  planned: 'Planned',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  in_service: 'In Service',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const statusColors: Record<AppointmentStatus, string> = {
  planned: 'bg-muted text-muted-foreground',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  checked_in: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  in_service: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  no_show: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

// Which statuses can transition to which
const statusTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  planned: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['in_service', 'cancelled', 'no_show'],
  in_service: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

interface AppointmentDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  allAppointments?: Appointment[]; // all appointments to find grouped ones
  staff: Staff[];
  services: Service[];
  clients: Client[];
  onUpdate: (updated: Appointment) => void;
  onStatusChange: (appointmentId: string, newStatus: AppointmentStatus) => void;
}

export function AppointmentDetailSheet({
  open,
  onOpenChange,
  appointment,
  allAppointments = [],
  staff,
  services,
  clients,
  onUpdate,
  onStatusChange,
}: AppointmentDetailSheetProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [editedAppointment, setEditedAppointment] = useState<Appointment | null>(null);
  const [retailItems, setRetailItems] = useState<CartItem[]>([]);
  const [recipe, setRecipe] = useState<Array<{ product_id: string; product_name: string; expected_qty: number; uom: string; actual_qty: string }>>([]);
  const [savingActuals, setSavingActuals] = useState(false);
  const { toast } = useToast();
  const { tenant } = useAuth();
  const lastSavedRef = useRef<string>('[]');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const appt = appointment as any;
    if (!appt?.id || !appt?.serviceId) { setRecipe([]); return; }
    (async () => {
      const { data: recipes } = await supabase
        .from('service_recipes')
        .select('product_id, quantity_per_service, product:products(name, usage_unit)')
        .eq('service_id', appt.serviceId);
      const { data: priors } = await supabase
        .from('service_consumption_actuals')
        .select('product_id, actual_qty')
        .eq('booking_id', appt.id);
      const priorMap = new Map<string, string>((priors || []).map((p: any) => [p.product_id, String(p.actual_qty)]));
      const rows = (recipes || []).map((r: any) => ({
        product_id: r.product_id,
        product_name: r.product?.name ?? '',
        expected_qty: Number(r.quantity_per_service || 0),
        uom: r.product?.usage_unit ?? '',
        actual_qty: priorMap.get(r.product_id) ?? '',
      }));
      setRecipe(rows);
    })();
  }, [(appointment as any)?.id, (appointment as any)?.serviceId]);

  async function saveActuals() {
    const appt = appointment as any;
    if (!appt?.id || !appt?.serviceId || !tenant?.id) return;
    setSavingActuals(true);
    try {
      await supabase.from('service_consumption_actuals').delete().eq('booking_id', appt.id);
      const rows = recipe
        .filter(r => r.actual_qty !== '')
        .map(r => ({
          tenant_id: tenant.id,
          booking_id: appt.id,
          service_id: appt.serviceId,
          product_id: r.product_id,
          staff_id: appt.staffId ?? null,
          expected_qty: r.expected_qty,
          actual_qty: Number(r.actual_qty),
        }));
      if (rows.length > 0) {
        const { error } = await supabase.from('service_consumption_actuals').insert(rows);
        if (error) throw error;
      }
      toast?.({ title: 'Back-bar usage saved' });
    } catch (err: any) {
      toast?.({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSavingActuals(false);
    }
  }



  useEffect(() => {
    if (!appointment) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('bookings')
        .select('pending_retail')
        .eq('id', appointment.id)
        .maybeSingle();
      if (cancelled) return;
      const items: CartItem[] = Array.isArray(data?.pending_retail) ? data.pending_retail : [];
      setRetailItems(items);
      lastSavedRef.current = JSON.stringify(items);
    })();
    return () => { cancelled = true; };
  }, [appointment?.id]);

  useEffect(() => {
    if (!appointment) return;
    const serialised = JSON.stringify(retailItems);
    if (serialised === lastSavedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('bookings')
        .update({ pending_retail: retailItems })
        .eq('id', appointment.id);
      if (!error) lastSavedRef.current = serialised;
      else console.error('[pending_retail] save failed', error);
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [retailItems, appointment?.id]);
  const [notes, setNotes] = useState('');

  // ── BOOKING vs PAYMENT: two independent states ─────────────────────────
  // booking.status === 'completed'  ⇒ the SERVICE was delivered.
  // transaction.status === 'completed' ⇒ money was collected.
  // Historically the UI conflated these, causing an unpaid completed booking
  // to display as "fully paid / checked out".  Never use booking status alone.
  // IMPORTANT: this hook MUST be called before any early-return to keep hook
  // order stable across renders (otherwise React throws "Rendered more hooks
  // than during the previous render" and the sheet fails to mount).
  const { data: payment } = useBookingPayment(appointment?.id);

  // Sync state when appointment changes
  const apt = editedAppointment?.id === appointment?.id ? editedAppointment : appointment;

  if (!appointment || !apt) return null;

  const isServiceDone    = appointment.status === 'completed';
  const isPaid           = !!payment?.isPaid;
  const isCheckedOut     = isServiceDone && isPaid;       // service done AND paid
  const isCompletedUnpaid = isServiceDone && !isPaid;     // service done, payment pending
  const isCancelled      = appointment.status === 'cancelled';
  const isNoShow         = appointment.status === 'no_show';
  // Lock edits when the record is fully closed-out or terminal.
  // IMPORTANT: unpaid-but-completed is NOT locked — reception needs POS access.
  const isLocked = isCheckedOut || isCancelled || isNoShow;

  const selectedStaff = staff.find((s) => s.id === apt.staffId);
  const selectedService = services.find((s) => s.id === apt.serviceId);
  const selectedClient = clients.find((c) => c.id === apt.clientId);
  const nextStatuses = statusTransitions[apt.status];

  const handleFieldChange = (field: keyof Appointment, value: string | number) => {
    if (isLocked) return;
    const updated = { ...apt, [field]: value };

    // Recalculate end time when start time or service changes
    if (field === 'startTime' || field === 'serviceId') {
      const svc = field === 'serviceId' ? services.find((s) => s.id === value) : selectedService;
      const startTime = field === 'startTime' ? (value as string) : apt.startTime;

      if (svc) {
        const [h, m] = startTime.split(':').map(Number);
        const endMinutes = h * 60 + m + svc.duration;
        const endH = Math.floor(endMinutes / 60);
        const endM = endMinutes % 60;
        updated.endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
        updated.duration = svc.duration;
        updated.serviceName = svc.name;
        updated.serviceCategory = svc.category;
        updated.price = svc.price;
      }
    }

    if (field === 'staffId') {
      const s = staff.find((st) => st.id === value);
      if (s) updated.staffId = s.id;
    }

    if (field === 'clientId') {
      const c = clients.find((cl) => cl.id === value);
      if (c) {
        updated.clientId = c.id;
        updated.clientName = c.name;
      }
    }

    setEditedAppointment(updated);
  };

  const handleSave = () => {
    if (isLocked || !editedAppointment) return;
    onUpdate({ ...editedAppointment, notes: notes || editedAppointment.notes });
    onOpenChange(false);
  };

  const handleStatusAction = (newStatus: AppointmentStatus) => {
    onStatusChange(appointment.id, newStatus);
    if (newStatus === 'completed') {
      onOpenChange(false);
    }
  };

  const addRetailProduct = (product: any) => {
    if (isLocked) return;
    setRetailItems(prev => {
      const idx = prev.findIndex(i => i.item_type === 'product' && i.item_id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        const q = next[idx].quantity + 1;
        next[idx] = { ...next[idx], quantity: q, total_price: Math.round(next[idx].unit_price * q * 1000) / 1000 };
        return next;
      }
      const price = Number(product.retail_price ?? product.unit_price ?? 0);
      return [
        ...prev,
        {
          item_type: 'product',
          item_id: product.id,
          item_name: product.name,
          item_name_ar: product.name_ar || undefined,
          quantity: 1,
          unit_price: price,
          total_price: price,
        } as CartItem,
      ];
    });
  };

  const updateRetailQty = (idx: number, qty: number) => {
    if (isLocked) return;
    setRetailItems(prev => {
      const next = [...prev];
      const q = Math.max(1, qty);
      next[idx] = { ...next[idx], quantity: q, total_price: Math.round(next[idx].unit_price * q * 1000) / 1000 };
      return next;
    });
  };

  const removeRetailItem = (idx: number) => {
    if (isLocked) return;
    setRetailItems(prev => prev.filter((_, i) => i !== idx));
  };

  const totalRetail = retailItems.reduce((s, i) => s + Number(i.total_price || 0), 0);
  const grandTotal = apt.price + totalRetail;

  // Generate time options (every 15 minutes)
  const timeOptions: string[] = [];
  for (let h = 8; h < 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      timeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  const contentBody = (
    <>
      <div className={cn("px-6 pt-6 pb-4 border-b", isMobile && "px-4 pt-4 pb-3")}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Appointment Details</h3>
          <Badge className={cn('text-xs', statusColors[apt.status])}>
            {statusLabels[apt.status]}
          </Badge>
        </div>
        {(isLocked || isCompletedUnpaid) && (
          <div className={cn(
            'flex items-center gap-2 text-sm rounded-md px-3 py-2 mt-2',
            isCompletedUnpaid
              ? 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800/60'
              : 'bg-muted/50 text-muted-foreground'
          )}>
            <AlertTriangle className={cn(
              'h-4 w-4 shrink-0',
              isCompletedUnpaid ? 'text-amber-600 dark:text-amber-400' : 'text-amber-500'
            )} />
            <span>
              {isCompletedUnpaid
                ? 'Service marked complete but payment not collected. Click Checkout to collect.'
                : isCheckedOut
                ? 'This appointment has been checked out. No changes allowed.'
                : isCancelled
                ? 'This appointment has been cancelled.'
                : 'This appointment was marked as no-show.'}
            </span>
          </div>
        )}
      </div>

      <ScrollArea className={cn("flex-1 overflow-auto", isMobile ? "max-h-[55vh]" : "max-h-[calc(100vh-220px)]")}>
          <Tabs defaultValue="details" className="px-6 py-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="details" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Details
              </TabsTrigger>
              <TabsTrigger value="services" className="gap-1.5">
                <Scissors className="h-3.5 w-3.5" />
                Services
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5" disabled={isLocked}>
                <ShoppingBag className="h-3.5 w-3.5" />
                Products
                {retailItems.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                    {retailItems.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="backbar" className="gap-1">
                <FlaskConical className="h-3.5 w-3.5" />
                Back-bar
                {recipe.length > 0 && (
                  <span className="ml-1 text-[10px] bg-muted-foreground/10 rounded px-1">{recipe.length}</span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* DETAILS TAB */}
            <TabsContent value="details" className="space-y-4 mt-4">
              {/* Client */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <User className="h-3.5 w-3.5" />
                  Client
                </Label>
                {isLocked ? (
                  <div className="px-3 py-2 rounded-md bg-muted text-sm">
                    {apt.clientName}
                    {selectedClient?.tier === 'vip' && (
                      <Badge variant="outline" className="ml-2 text-xs border-amber-500 text-amber-600">
                        VIP
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Select
                    value={apt.clientId}
                    onValueChange={(v) => handleFieldChange('clientId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.tier === 'vip' ? '⭐' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    Date
                  </Label>
                  {isLocked ? (
                    <div className="px-3 py-2 rounded-md bg-muted text-sm">{apt.date}</div>
                  ) : (
                    <Input
                      type="date"
                      value={apt.date}
                      onChange={(e) => handleFieldChange('date', e.target.value)}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Start Time</Label>
                  {isLocked ? (
                    <div className="px-3 py-2 rounded-md bg-muted text-sm">
                      {apt.startTime} - {apt.endTime}
                    </div>
                  ) : (
                    <Select
                      value={apt.startTime}
                      onValueChange={(v) => handleFieldChange('startTime', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Staff */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Staff Member</Label>
                {isLocked ? (
                  <div className="px-3 py-2 rounded-md bg-muted text-sm flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedStaff?.color }}
                    />
                    {selectedStaff?.name}
                  </div>
                ) : (
                  <Select
                    value={apt.staffId}
                    onValueChange={(v) => handleFieldChange('staffId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes</Label>
                <Textarea
                  placeholder="Add appointment notes..."
                  value={notes || apt.notes || ''}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isLocked}
                  rows={3}
                />
              </div>

              {/* Status Actions */}
              {nextStatuses.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Quick Actions</Label>
                    <div className="flex flex-wrap gap-2">
                      {nextStatuses.map((status) => {
                        const isPositive = ['confirmed', 'checked_in', 'in_service', 'completed'].includes(status);
                        const isNegative = ['cancelled', 'no_show'].includes(status);
                        return (
                          <Button
                            key={status}
                            size="sm"
                            variant={isNegative ? 'destructive' : isPositive ? 'default' : 'outline'}
                            onClick={() => handleStatusAction(status)}
                            className="gap-1.5"
                          >
                            {isPositive && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {isNegative && <XCircle className="h-3.5 w-3.5" />}
                            {statusLabels[status]}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* SERVICES TAB */}
            <TabsContent value="services" className="space-y-4 mt-4">
              {/* Grouped services display */}
              {(() => {
                const groupedApts = apt.groupId
                  ? allAppointments.filter((a) => a.groupId === apt.groupId)
                  : [apt];

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        {groupedApts.length > 1 ? `Services (${groupedApts.length})` : 'Service'}
                      </Label>
                      {groupedApts.length > 1 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Users className="h-3 w-3" />
                          Multi-Service
                        </Badge>
                      )}
                    </div>

                    {groupedApts.map((groupApt) => {
                      const svc = services.find((s) => s.id === groupApt.serviceId);
                      const stf = staff.find((s) => s.id === groupApt.staffId);
                      const isCurrent = groupApt.id === apt.id;

                      return (
                        <div
                          key={groupApt.id}
                          className={cn(
                            'rounded-lg border p-3 space-y-2',
                            isCurrent && 'border-primary/50 bg-primary/5'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor: svc
                                    ? SERVICE_CATEGORY_COLORS[svc.category]
                                    : undefined,
                                }}
                              />
                              <span className="font-medium text-sm">
                                {groupApt.serviceName}
                              </span>
                              {isCurrent && (
                                <Badge variant="secondary" className="text-xs">Current</Badge>
                              )}
                            </div>
                            <span className="text-sm font-semibold">
                              {groupApt.price.toFixed(3)} KWD
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {groupApt.startTime} - {groupApt.endTime}
                            </span>
                            <span>{groupApt.duration} min</span>
                            {stf && (
                              <span className="flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full inline-block"
                                  style={{ backgroundColor: stf.color }}
                                />
                                {stf.name}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Change current service (only if not locked) */}
              {!isLocked && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Change Service</Label>
                  <Select
                    value={apt.serviceId}
                    onValueChange={(v) => handleFieldChange('serviceId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: SERVICE_CATEGORY_COLORS[s.category] }}
                            />
                            {s.name}
                            <span className="text-muted-foreground text-xs ml-2">
                              {s.duration}min · {s.price.toFixed(3)} KWD
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Price summary */}
              <Separator />
              <div className="space-y-2">
                {(() => {
                  const groupedApts = apt.groupId
                    ? allAppointments.filter((a) => a.groupId === apt.groupId)
                    : [apt];
                  const serviceTotal = groupedApts.reduce((sum, a) => sum + a.price, 0);

                  return (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {groupedApts.length > 1 ? 'All Services Total' : 'Service Total'}
                        </span>
                        <span className="font-semibold">{serviceTotal.toFixed(3)} KWD</span>
                      </div>
                      {retailItems.length > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Retail Products</span>
                          <span>{totalRetail.toFixed(3)} KWD</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>Grand Total</span>
                        <span>{(serviceTotal + totalRetail).toFixed(3)} KWD</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </TabsContent>

            {/* PRODUCTS TAB */}
            <TabsContent value="products" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Add retail products</Label>
                <ProductSearch onAddProduct={addRetailProduct} />
                <p className="text-[11px] text-muted-foreground">
                  Items added here will appear in the POS cart automatically at checkout.
                </p>
              </div>

              {retailItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No retail products added yet.</p>
                  <p className="text-xs mt-1">Search above to add a product.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {retailItems.map((item, idx) => (
                    <div key={`${item.item_id}-${idx}`} className="flex items-center gap-2 rounded-lg border p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.item_name}</p>
                        {item.item_name_ar && (
                          <p className="text-xs text-muted-foreground truncate" dir="rtl">{item.item_name_ar}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {Number(item.unit_price).toFixed(3)} KWD × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 border rounded-md">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => updateRetailQty(idx, item.quantity - 1)} disabled={isLocked}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-6 text-center">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => updateRetailQty(idx, item.quantity + 1)} disabled={isLocked}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-medium ml-2 w-20 text-right">
                        {Number(item.total_price).toFixed(3)}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => removeRetailItem(idx)} disabled={isLocked}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t text-sm">
                    <span className="text-muted-foreground">Products subtotal</span>
                    <span className="font-semibold">{totalRetail.toFixed(3)} KWD</span>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="backbar" className="space-y-3">
              {recipe.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No recipe defined for this service.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Log actual product usage. Variance is calculated against the recipe.</p>
                  <div className="space-y-2">
                    {recipe.map((r, i) => (
                      <div key={r.product_id} className="flex items-center gap-2 p-2 border rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.product_name}</p>
                          <p className="text-[10px] text-muted-foreground">Recipe: {r.expected_qty} {r.uom}</p>
                        </div>
                        <Input
                          type="number" step="0.001"
                          placeholder={String(r.expected_qty)}
                          className="w-24 h-8 text-sm"
                          value={r.actual_qty}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRecipe(prev => prev.map((x, j) => j === i ? { ...x, actual_qty: v } : x));
                          }}
                        />
                        <span className="text-xs text-muted-foreground w-8">{r.uom}</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={saveActuals} disabled={savingActuals} className="w-full">
                    <SaveIcon className="h-4 w-4 mr-1.5" />
                    {savingActuals ? 'Saving…' : 'Save back-bar usage'}
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        {/* Footer Actions */}
        <div className={cn("border-t px-6 py-4 flex items-center gap-2", isMobile && "px-4 py-3")}>
          {isCheckedOut ? (
            <Button
              className="flex-1 gap-1.5"
              variant="outline"
              onClick={() => navigate(`/pos?bookingId=${appointment.id}&from=calendar`, { state: { returnTo: '/calendar', fromAppointmentId: appointment.id } })}
            >
              <CreditCard className="h-4 w-4" />
              View Receipt
            </Button>
          ) : isCompletedUnpaid ? (
            // Service done, payment not collected — surface this as the single primary action.
            <>
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => navigate(`/pos?bookingId=${appointment.id}&from=calendar`, { state: { returnTo: '/calendar', fromAppointmentId: appointment.id } })}
              >
                <CreditCard className="h-4 w-4" />
                Collect Payment
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={isLocked || !editedAppointment}
              >
                Save Changes
              </Button>
              {(apt.status === 'in_service' || apt.status === 'completed') && (
                <Button
                  className="gap-1.5"
                  onClick={() => navigate(`/pos?bookingId=${appointment.id}&from=calendar`, { state: { returnTo: '/calendar', fromAppointmentId: appointment.id } })}
                >
                  <CreditCard className="h-4 w-4" />
                  Checkout
                </Button>
              )}
            </>
          )}
        </div>
      </>
    );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Appointment Details</DrawerTitle>
          </DrawerHeader>
          {contentBody}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Appointment Details</SheetTitle>
        </SheetHeader>
        {contentBody}
      </SheetContent>
    </Sheet>
  );
}
