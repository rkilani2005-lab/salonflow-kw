import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, UserPlus, Phone, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useClients } from '@/hooks/useClients';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface Props {
  /** Currently selected client id ('' = none). */
  value: string;
  onChange: (clientId: string) => void;
  /** Name of the selected client, for the trigger label (avoids a lookup
   *  when the selected client isn't in the current search results). */
  selectedName?: string;
  /** Fired when the user chooses "Create new customer". Receives whatever
   *  they typed so the create form can prefill name or phone. */
  onCreateNew: (searchTerm: string) => void;
  placeholder?: string;
}

/**
 * Type-to-search client picker. Searches name / phone / email server-side
 * (Postgres ilike — matches Arabic and Latin text equally). When no match
 * is found, offers a "Create new customer" action carrying the search term.
 */
const ClientSearchSelect = ({ value, onChange, selectedName, onCreateNew, placeholder }: Props) => {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, 250);

  const { data: results = [], isFetching } = useClients(debounced);

  const selected = useMemo(
    () => results.find(c => c.id === value),
    [results, value]
  );
  const label = selected?.name || selectedName || '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', !label && 'text-muted-foreground')}
        >
          <span className="truncate">{label || (placeholder ?? 'Search client by name or mobile…')}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        {/* shouldFilter=false: results are already filtered server-side, and
            cmdk's built-in fuzzy filter doesn't handle Arabic well. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a name or mobile number…"
            value={term}
            onValueChange={setTerm}
          />
          <CommandList>
            {/* Empty / create-new state */}
            {results.length === 0 && (
              <CommandEmpty className="py-3 px-2">
                <div className="text-sm text-muted-foreground mb-2 px-1">
                  {isFetching ? 'Searching…' : term.trim() ? 'No matching client found.' : 'Start typing to search.'}
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => { setOpen(false); onCreateNew(term.trim()); }}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Create new customer{term.trim() ? ` “${term.trim()}”` : ''}
                </Button>
              </CommandEmpty>
            )}

            {results.length > 0 && (
              <>
                <CommandGroup heading="Clients">
                  {results.map(c => (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => { onChange(c.id); setOpen(false); }}
                      className="flex items-center gap-2"
                    >
                      <Check className={cn('h-4 w-4 shrink-0', value === c.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{c.name}</span>
                          {c.tier === 'vip' && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                        </span>
                        {c.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />{c.phone}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {/* Always offer create-new under the results too */}
                <div className="border-t p-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-1.5 text-primary"
                    onClick={() => { setOpen(false); onCreateNew(term.trim()); }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Create new customer{term.trim() ? ` “${term.trim()}”` : ''}
                  </Button>
                </div>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ClientSearchSelect;
