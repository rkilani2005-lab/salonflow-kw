import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Staff, Service } from '@/types/calendar';
import { UserPlus, Clock, Search, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface WalkInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff[];
  services: Service[];
  onSubmit: (walkin: {
    clientName: string;
    clientPhone: string;
    staffId: string;
    serviceId: string;
    startTime: string;
    notes: string;
    isWalkIn: true;
  }) => Promise<void>;
}

const SERVICE_CATEGORY_EMOJI: Record<string, string> = {
  hair: '✂️', nails: '💅', facial: '🧖‍♀️', makeup: '💄',
  waxing: '🪒', massage: '💆‍♀️', other: '✨',
};

export function WalkInDialog({ open, onOpenChange, staff, services, onSubmit }: WalkInDialogProps) {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${Math.floor(now.getMinutes() / 5) * 5 === 0 ? '00' : (Math.floor(now.getMinutes() / 5) * 5).toString().padStart(2, '0')}`;

  const [clientName,  setClientName]  = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [staffId,     setStaffId]     = useState('');
  const [serviceId,   setServiceId]   = useState('');
  const [startTime,   setStartTime]   = useState(currentTime);
  const [notes,       setNotes]       = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setClientName('');
      setClientPhone('');
      setServiceId('');
      setNotes('');
      setServiceSearch('');
      const n = new Date();
      setStartTime(`${n.getHours().toString().padStart(2,'0')}:${Math.floor(n.getMinutes()/5)*5 === 0 ? '00' : (Math.floor(n.getMinutes()/5)*5).toString().padStart(2,'0')}`);
      // Auto-select first available staff
      const avail = staff.find(s => s.status !== 'off');
      setStaffId(avail?.id || staff[0]?.id || '');
    }
  }, [open, staff]);

  const selectedService = services.find(s => s.id === serviceId);
  const selectedStaff   = staff.find(s => s.id === staffId);

  const filteredServices = services.filter(s =>
    !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    s.category.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  // Group services by category for quick selection
  const grouped = filteredServices.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, Service[]>);

  const canSubmit = clientName.trim().length >= 2 && serviceId && staffId;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        staffId,
        serviceId,
        startTime,
        notes,
        isWalkIn: true,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-base font-bold">Walk-In Customer</p>
              <p className="text-xs font-normal text-muted-foreground">
                {format(now, 'EEEE, MMMM d')} · Now {format(now, 'h:mm a')}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Client info — minimal, just name required */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Client Name *</Label>
              <Input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="e.g. Fatima"
                className="h-10"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                placeholder="+965 9XXX XXXX"
                className="h-10"
              />
            </div>
          </div>

          {/* Service selection — visual grid */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Service *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={serviceSearch}
                onChange={e => setServiceSearch(e.target.value)}
                placeholder="Search services..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
              {Object.entries(grouped).map(([cat, svcs]) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1">
                    {SERVICE_CATEGORY_EMOJI[cat]} {cat}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {svcs.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setServiceId(s.id)}
                        className={cn(
                          'text-left p-2.5 rounded-xl border text-xs transition-all',
                          serviceId === s.id
                            ? 'border-primary bg-primary/8 font-semibold'
                            : 'border-border bg-card hover:border-primary/40'
                        )}
                      >
                        <p className="font-medium truncate">{s.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{s.duration}m</span>
                          <span className="font-semibold text-foreground">{s.price.toFixed(3)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredServices.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No services found</p>
              )}
            </div>
          </div>

          {/* Staff + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Stylist *</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select stylist" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: s.color }}>
                          {s.name[0]}
                        </div>
                        <span>{s.name}</span>
                        {s.status === 'available' && <Badge variant="outline" className="text-[9px] h-3.5 px-1 ml-1 text-emerald-600 border-emerald-300">Free</Badge>}
                        {s.status === 'busy' && <Badge variant="outline" className="text-[9px] h-3.5 px-1 ml-1 text-amber-600 border-amber-300">Busy</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. prefers no heat, allergic to..."
              className="h-9 text-sm"
            />
          </div>

          {/* Summary card */}
          {selectedService && selectedStaff && clientName && (
            <div className="rounded-xl bg-primary/6 border border-primary/20 p-3.5 flex items-center gap-3">
              <Zap className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="text-xs">
                <p className="font-semibold">{clientName} → {selectedService.name}</p>
                <p className="text-muted-foreground mt-0.5">
                  {selectedStaff.name} · {startTime} ({selectedService.duration}min) · {selectedService.price.toFixed(3)} KWD
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || submitting} className="gap-1.5 min-w-[120px]">
            {submitting ? (
              <span className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <><UserPlus className="h-3.5 w-3.5" />Check In Now</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
