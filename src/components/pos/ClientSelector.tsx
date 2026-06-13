import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClients, type Client } from '@/hooks/useClients';
import { Search, User, UserX } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface ClientSelectorProps {
  selectedClient: Client | null;
  isGuest: boolean;
  onSelectClient: (client: Client) => void;
  onSelectGuest: () => void;
  onClear: () => void;
  /** When the guest came from a booking with a captured name/phone, show
   *  those instead of the generic "Guest Customer" label. */
  guestLabel?: string;
  guestPhone?: string | null;
}

export function ClientSelector({ selectedClient, isGuest, onSelectClient, onSelectGuest, onClear, guestLabel, guestPhone }: ClientSelectorProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { data: clients, isLoading } = useClients(debouncedSearch);

  if (selectedClient || isGuest) {
    return (
      <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          {isGuest ? <UserX className="h-5 w-5 text-muted-foreground" /> : <User className="h-5 w-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {isGuest ? (guestLabel || 'Guest Customer') : selectedClient?.name}
          </p>
          {selectedClient && (
            <p className="text-sm text-muted-foreground">{selectedClient.phone}</p>
          )}
          {isGuest && guestPhone && (
            <p className="text-sm text-muted-foreground">{guestPhone}</p>
          )}
        </div>
        {selectedClient?.tier && selectedClient.tier !== 'normal' && (
          <Badge variant="secondary" className="uppercase text-xs">
            {selectedClient.tier}
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={onClear}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search client by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>
      <Button
        variant="outline"
        className="w-full h-12 text-base"
        onClick={onSelectGuest}
      >
        <UserX className="mr-2 h-5 w-5" />
        Continue as Guest
      </Button>
      {debouncedSearch && (
        <ScrollArea className="max-h-48">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-3">Searching...</p>
          ) : clients && clients.length > 0 ? (
            <div className="space-y-1">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => onSelectClient(client)}
                  className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent/10 text-left transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.phone}</p>
                  </div>
                  {client.tier !== 'normal' && (
                    <Badge variant="secondary" className="uppercase text-xs">
                      {client.tier}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground p-3">No clients found</p>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
