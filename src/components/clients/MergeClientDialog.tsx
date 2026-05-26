import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertCircle, ArrowRight, Loader2, Mail, Phone, Search, User as UserIcon,
} from 'lucide-react';
import { useClients, useMergeClients, Client } from '@/hooks/useClients';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The client that will SURVIVE the merge.  The picked duplicate is
   *  deleted and all its bookings/conversations/transactions/etc. are
   *  reassigned to this primary. */
  primary: Pick<Client, 'id' | 'name' | 'phone' | 'email'>;
  /** Called after a successful merge. */
  onMerged?: () => void;
}

const MergeClientDialog = ({ open, onOpenChange, primary, onMerged }: Props) => {
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const merge = useMergeClients();

  // Reuse the existing clients search instead of building a new RPC.
  // Skip the primary itself.
  const { data: clients = [], isLoading } = useClients(search);
  const candidates = clients.filter(c => c.id !== primary.id).slice(0, 25);

  const picked = candidates.find(c => c.id === pickedId) ?? null;

  const reset = () => {
    setSearch('');
    setPickedId(null);
    setConfirming(false);
  };

  const handleClose = (next: boolean) => {
    if (merge.isPending) return; // don't let user navigate away mid-merge
    if (!next) reset();
    onOpenChange(next);
  };

  const doMerge = async () => {
    if (!picked) return;
    try {
      await merge.mutateAsync({ primary_id: primary.id, duplicate_id: picked.id });
      reset();
      onOpenChange(false);
      onMerged?.();
    } catch {
      /* toast already shown by hook's onError */
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Merge another client into this one</DialogTitle>
          <DialogDescription>
            All bookings, conversations, transactions, and loyalty points from
            the picked duplicate will move to <b>{primary.name}</b>. The
            duplicate row will be deleted.
          </DialogDescription>
        </DialogHeader>

        {!confirming ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="merge-search">Search for duplicate</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
                <Input
                  id="merge-search"
                  className="pl-8"
                  placeholder="Name, phone, or email"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/30">
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin"/> Loading…
                </div>
              ) : candidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {search ? 'No clients match that search.' : 'Type to search clients.'}
                </div>
              ) : (
                <ul className="divide-y">
                  {candidates.map(c => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setPickedId(c.id)}
                        className={cn(
                          'w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-background transition',
                          pickedId === c.id && 'bg-background ring-2 ring-primary',
                        )}
                      >
                        <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {c.phone}{c.email ? ` · ${c.email}` : ''}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                disabled={!picked}
                onClick={() => setConfirming(true)}
              >
                Next: Confirm merge
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex gap-2">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5"/>
              <div className="text-sm">
                This will permanently delete the duplicate row and cannot be
                undone. All references will be reassigned to <b>{primary.name}</b>.
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
              <div className="rounded-md border p-2 text-xs space-y-0.5">
                <div className="font-semibold uppercase text-[10px] text-muted-foreground">Duplicate · will be deleted</div>
                <div className="font-medium truncate">{picked?.name}</div>
                <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3"/> {picked?.phone}</div>
                {picked?.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3"/> {picked.email}</div>}
              </div>
              <ArrowRight className="self-center text-muted-foreground"/>
              <div className="rounded-md border border-primary/40 bg-primary/5 p-2 text-xs space-y-0.5">
                <div className="font-semibold uppercase text-[10px] text-primary">Primary · keeps everything</div>
                <div className="font-medium truncate">{primary.name}</div>
                <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3"/> {primary.phone}</div>
                {primary.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3"/> {primary.email}</div>}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={merge.isPending}>Back</Button>
              <Button
                variant="destructive"
                onClick={doMerge}
                disabled={merge.isPending}
              >
                {merge.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5"/>}
                Merge now
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MergeClientDialog;
