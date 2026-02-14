import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Staff, Service, Client, SERVICE_CATEGORY_COLORS } from '@/types/calendar';
import { Plus, Trash2, Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface ServiceEntry {
  id: string;
  serviceId: string;
  staffId: string;
  time: string;
}

export interface MultiServiceBooking {
  clientId: string;
  date: string;
  notes: string;
  services: ServiceEntry[];
}

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff[];
  services: Service[];
  clients: Client[];
  preselectedStaffId?: string;
  preselectedTime?: string;
  preselectedDate?: string;
  onSubmit: (booking: {
    clientId: string;
    staffId: string;
    serviceId: string;
    date: string;
    time: string;
    notes: string;
  }) => void;
  onSubmitMulti?: (booking: MultiServiceBooking) => void;
}

export function BookingFormDialog({
  open,
  onOpenChange,
  staff,
  services,
  clients,
  preselectedStaffId,
  preselectedTime,
  preselectedDate,
  onSubmit,
  onSubmitMulti,
}: BookingFormDialogProps) {
  const isMobile = useIsMobile();
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState(preselectedDate || new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([
    {
      id: `entry-${Date.now()}`,
      serviceId: '',
      staffId: preselectedStaffId || '',
      time: preselectedTime || '09:00',
    },
  ]);

  useEffect(() => {
    if (open) {
      setServiceEntries([
        {
          id: `entry-${Date.now()}`,
          serviceId: '',
          staffId: preselectedStaffId || '',
          time: preselectedTime || '09:00',
        },
      ]);
      setClientId('');
      setNotes('');
      setDate(preselectedDate || new Date().toISOString().split('T')[0]);
    }
  }, [open, preselectedStaffId, preselectedTime, preselectedDate]);

  const addServiceEntry = () => {
    setServiceEntries((prev) => [
      ...prev,
      {
        id: `entry-${Date.now()}`,
        serviceId: '',
        staffId: '',
        time: preselectedTime || '09:00',
      },
    ]);
  };

  const removeServiceEntry = (index: number) => {
    if (serviceEntries.length <= 1) return;
    setServiceEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof ServiceEntry, value: string) => {
    setServiceEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const isValid = clientId && serviceEntries.every((e) => e.serviceId && e.staffId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    if (serviceEntries.length === 1) {
      const entry = serviceEntries[0];
      onSubmit({
        clientId,
        staffId: entry.staffId,
        serviceId: entry.serviceId,
        date,
        time: entry.time,
        notes,
      });
    } else if (onSubmitMulti) {
      onSubmitMulti({ clientId, date, notes, services: serviceEntries });
    }

    onOpenChange(false);
  };

  const totalPrice = serviceEntries.reduce((sum, entry) => {
    const svc = services.find((s) => s.id === entry.serviceId);
    return sum + (svc?.price || 0);
  }, 0);

  const totalDuration = serviceEntries.reduce((sum, entry) => {
    const svc = services.find((s) => s.id === entry.serviceId);
    return sum + (svc?.duration || 0);
  }, 0);

  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
      <ScrollArea className={cn("flex-1 overflow-auto", isMobile ? "max-h-[55vh] px-4" : "max-h-[calc(90vh-160px)] px-6")}>
        <div className="space-y-4 pb-4">
          {/* Client */}
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} {client.tier === 'vip' && '⭐'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <Separator />

          {/* Service Entries */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Services</Label>
              <Button type="button" size="sm" variant="outline" onClick={addServiceEntry} className="gap-1.5 h-7 text-xs">
                <Plus className="h-3 w-3" />
                Add Service
              </Button>
            </div>

            {serviceEntries.map((entry, index) => {
              const selectedSvc = services.find((s) => s.id === entry.serviceId);
              return (
                <div key={entry.id} className="rounded-lg border p-3 space-y-3 relative">
                  {serviceEntries.length > 1 && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Service {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeServiceEntry(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  <Select value={entry.serviceId} onValueChange={(v) => updateEntry(index, 'serviceId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service..." />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: SERVICE_CATEGORY_COLORS[service.category] }}
                            />
                            {service.name} ({service.duration}min) - {service.price.toFixed(3)} KWD
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Technician</Label>
                      <Select value={entry.staffId} onValueChange={(v) => updateEntry(index, 'staffId', v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Staff..." />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              <span className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full inline-block"
                                  style={{ backgroundColor: member.color }}
                                />
                                {member.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Start Time</Label>
                      <Input
                        type="time"
                        step="900"
                        value={entry.time}
                        onChange={(e) => updateEntry(index, 'time', e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>

                  {selectedSvc && (
                    <div className="text-xs text-muted-foreground flex items-center gap-3 pt-1">
                      <span>{selectedSvc.duration} min</span>
                      <span>{selectedSvc.price.toFixed(3)} KWD</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          {serviceEntries.some((e) => e.serviceId) && (
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Duration</span>
                <span className="font-medium">{totalDuration} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Price</span>
                <span className="font-semibold">{totalPrice.toFixed(3)} KWD</span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any special requests or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </ScrollArea>

      <div className={cn("flex gap-2 border-t", isMobile ? "p-4" : "px-6 py-4")}>
        <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid} className="flex-1">
          Create Booking
        </Button>
      </div>
    </form>
  );

  const headerContent = (
    <div className="flex items-center gap-2">
      New Booking
      {serviceEntries.length > 1 && (
        <span className="text-xs font-normal bg-primary/10 text-primary rounded-full px-2 py-0.5">
          <Users className="inline h-3 w-3 mr-1" />
          {serviceEntries.length} services
        </span>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{headerContent}</DrawerTitle>
          </DrawerHeader>
          {formContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{headerContent}</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
