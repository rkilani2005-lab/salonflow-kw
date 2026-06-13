import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhoneInput } from '@/lib/phoneUtils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Staff, Service } from '@/types/calendar';
import { UserPlus, Clock, Search, Zap, ChevronDown, Phone, CheckCircle2, UserCircle2, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useClients, useCreateClient, useFindSimilarClients, type Client, type SimilarClient } from '@/hooks/useClients';
import { useDebounce } from '@/hooks/useDebounce';
import SimilarClientSuggestions from '@/components/clients/SimilarClientSuggestions';

interface WalkInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff[];
  services: Service[];
  onSubmit: (walkin: {
    clientName: string;
    clientPhone: string;
    clientId?: string;
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

type ClientMode = 'search' | 'selected' | 'new';

export function WalkInDialog({ open, onOpenChange, staff, services, onSubmit }: WalkInDialogProps) {
  const now = new Date();
  const roundedMinutes = Math.floor(now.getMinutes() / 5) * 5;
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;

  // Client state
  const [clientMode, setClientMode]     = useState<ClientMode>('search');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // New client quick-add
  const [newName,  setNewName]  = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Booking state
  const [staffId,       setStaffId]       = useState('');
  const [serviceId,     setServiceId]     = useState('');
  const [startTime,     setStartTime]     = useState(currentTime);
  const [notes,         setNotes]         = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [submitting,    setSubmitting]    = useState(false);

  const debouncedSearch = useDebounce(clientSearch, 300);
  const { data: clients = [] } = useClients(debouncedSearch || undefined);
  const createClient = useCreateClient();

  // Hard duplicate guard for new-client mode: if an exact phone/email match
  // already exists, block creation (the user should pick the existing one).
  const { data: dupMatches = [] } = useFindSimilarClients(
    clientMode === 'new' ? { name: newName, phone: newPhone, email: newEmail } : {}
  );
  const hasHardDuplicate = clientMode === 'new'
    && dupMatches.some(d => d.match_reason === 'phone' || d.match_reason === 'email');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setClientMode('search');
      setClientSearch('');
      setSelectedClient(null);
      setShowDropdown(false);
      setNewName(''); setNewPhone(''); setNewEmail('');
      setServiceId(''); setNotes(''); setServiceSearch('');
      const n = new Date();
      const rm = Math.floor(n.getMinutes() / 5) * 5;
      setStartTime(`${n.getHours().toString().padStart(2, '0')}:${rm.toString().padStart(2, '0')}`);
      const avail = staff.find(s => s.status !== 'off');
      setStaffId(avail?.id || staff[0]?.id || '');
    }
  }, [open, staff]);

  // Show dropdown when searching and there are results
  useEffect(() => {
    if (debouncedSearch && clientMode === 'search') {
      setShowDropdown(true);
    }
  }, [debouncedSearch, clientMode]);

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setClientMode('selected');
    setShowDropdown(false);
    setClientSearch('');
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setClientMode('search');
    setClientSearch('');
    setShowDropdown(false);
  };

  const handleSwitchToNew = () => {
    // Pre-fill new client name from search
    setNewName(clientSearch);
    setClientMode('new');
    setShowDropdown(false);
  };

  // When a duplicate (same phone/email) surfaces in the new-client form,
  // let the user adopt the existing client instead of creating a dupe.
  const handlePickSimilar = (c: SimilarClient) => {
    setSelectedClient({
      id: c.id,
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? undefined,
      tier: 'normal',
    } as Client);
    setClientMode('selected');
    setNewName(''); setNewPhone(''); setNewEmail('');
  };

  const selectedService = services.find(s => s.id === serviceId);
  const selectedStaff   = staff.find(s => s.id === staffId);

  const filteredServices = services.filter(s =>
    !serviceSearch ||
    s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    s.category.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const grouped = filteredServices.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, Service[]>);

  // Derived values for display
  const displayName = clientMode === 'selected'
    ? selectedClient?.name || ''
    : clientMode === 'new'
      ? newName
      : '';

  const canSubmit =
    serviceId && staffId && !hasHardDuplicate && (
      (clientMode === 'selected' && selectedClient) ||
      (clientMode === 'new' && newName.trim().length >= 2 && newPhone.trim().length >= 4)
    );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      let clientId: string | undefined;
      let clientName: string;
      let clientPhone: string;

      if (clientMode === 'selected' && selectedClient) {
        clientId    = selectedClient.id;
        clientName  = selectedClient.name;
        clientPhone = selectedClient.phone;
      } else {
        // Create new client first
        const created = await createClient.mutateAsync({
          name:  newName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim() || undefined,
        });
        clientId    = created.id;
        clientName  = created.name;
        clientPhone = created.phone;
      }

      await onSubmit({
        clientId,
        clientName,
        clientPhone,
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

  // Filter shown clients — limit to 6 in dropdown
  const filteredClients = clients.slice(0, 6);

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

          {/* ── CLIENT SECTION ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Client *</Label>

            {/* Selected client chip */}
            {clientMode === 'selected' && selectedClient && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/30 bg-primary/5">
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {selectedClient.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{selectedClient.name}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Phone className="h-2.5 w-2.5" />{selectedClient.phone}
                    {selectedClient.tier !== 'normal' && (
                      <Badge variant="outline" className={cn("text-[9px] h-3.5 px-1 ml-1",
                        selectedClient.tier === 'vvip' ? 'text-amber-600 border-amber-300' : 'text-purple-600 border-purple-300'
                      )}>{selectedClient.tier.toUpperCase()}</Badge>
                    )}
                  </p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                <button onClick={handleClearClient} className="p-0.5 rounded hover:bg-muted ml-1">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Search input */}
            {clientMode === 'search' && (
              <div className="relative" ref={dropdownRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search by name or phone..."
                  className="pl-8 h-10"
                  autoFocus
                />
                {clientSearch && (
                  <button
                    onClick={() => { setClientSearch(''); setShowDropdown(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}

                {/* Dropdown */}
                {showDropdown && clientSearch && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                    {filteredClients.length > 0 ? (
                      <>
                        {filteredClients.map(client => (
                          <button
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left transition-colors"
                          >
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {client.name[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{client.name}</p>
                              <p className="text-[10px] text-muted-foreground">{client.phone}</p>
                            </div>
                            {client.tier !== 'normal' && (
                              <Badge variant="outline" className={cn("text-[9px] h-3.5 px-1",
                                client.tier === 'vvip' ? 'text-amber-600 border-amber-300' : 'text-purple-600 border-purple-300'
                              )}>{client.tier.toUpperCase()}</Badge>
                            )}
                          </button>
                        ))}
                        <div className="border-t border-border">
                          <button
                            onClick={handleSwitchToNew}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-primary/5 transition-colors"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Add "{clientSearch}" as new client
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground text-center mb-2">No existing client found</p>
                        <button
                          onClick={handleSwitchToNew}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Add "{clientSearch}" as new client
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Hint when empty */}
                {!clientSearch && (
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">
                    Type to search existing clients or{' '}
                    <button onClick={() => setClientMode('new')} className="text-primary underline-offset-2 hover:underline">
                      add new client
                    </button>
                  </p>
                )}
              </div>
            )}

            {/* New client quick-add form */}
            {clientMode === 'new' && (
              <div className="rounded-xl border border-dashed border-primary/40 bg-primary/3 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <UserCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">New Client</span>
                  </div>
                  <button
                    onClick={() => { setClientMode('search'); setNewName(''); setNewPhone(''); setNewEmail(''); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold">Name *</Label>
                    <Input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Client name"
                      className="h-8 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold">Phone *</Label>
                    <Input
                      value={newPhone}
                      onFocus={() => { if (!newPhone) setNewPhone('+965 '); }}
                      onChange={e => setNewPhone(formatPhoneInput(e.target.value))}
                      placeholder="+965 9XXX XXXX"
                      className="h-8 text-xs font-mono"
                      inputMode="numeric"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="h-8 text-xs"
                  />
                </div>
                {/* Live duplicate detection on phone / email (or name).
                    Picking a match adopts the existing client instead of
                    creating a duplicate — same RPC AddClientDialog uses. */}
                <SimilarClientSuggestions
                  name={newName}
                  phone={newPhone}
                  email={newEmail}
                  onPickExisting={handlePickSimilar}
                />
                {newName.trim().length >= 2 && newPhone.trim().length >= 4 && (
                  <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Client will be created when you check in
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── SERVICE SELECTION ── */}
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

          {/* ── STAFF + TIME ── */}
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

          {/* ── NOTES ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. prefers no heat, allergic to..."
              className="h-9 text-sm"
            />
          </div>

          {/* ── SUMMARY ── */}
          {selectedService && selectedStaff && displayName && (
            <div className="rounded-xl bg-primary/6 border border-primary/20 p-3.5 flex items-center gap-3">
              <Zap className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="text-xs">
                <p className="font-semibold">{displayName} → {selectedService.name}</p>
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
