import { useFindSimilarClients, SimilarClient } from '@/hooks/useClients';
import { AlertCircle, Mail, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  name?:  string;
  phone?: string;
  email?: string;
  /** Called when the user picks an existing client instead of creating new. */
  onPickExisting: (client: SimilarClient) => void;
}

/**
 * Live suggestions panel for the New Client form.
 * Renders nothing if the form fields are too short to query (handled by
 * the hook) or no matches were found.
 */
const REASON_ICON: Record<SimilarClient['match_reason'], JSX.Element> = {
  phone: <Phone className="h-3.5 w-3.5"/>,
  email: <Mail  className="h-3.5 w-3.5"/>,
  name:  <User  className="h-3.5 w-3.5"/>,
};

const REASON_LABEL: Record<SimilarClient['match_reason'], string> = {
  phone: 'Same phone',
  email: 'Same email',
  name:  'Similar name',
};

const SimilarClientSuggestions = ({ name, phone, email, onPickExisting }: Props) => {
  const { data, isFetching } = useFindSimilarClients({ name, phone, email });

  if (isFetching && !data) return null;
  if (!data || data.length === 0) return null;

  // Phone & email matches are HARD conflicts — the unique constraint will
  // block the insert anyway. Highlight those visually.
  const hasHardConflict = data.some(d => d.match_reason === 'phone' || d.match_reason === 'email');

  return (
    <div
      className={cn(
        'rounded-md border p-3 space-y-2',
        hasHardConflict
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-amber-500/40 bg-amber-500/5',
      )}
      role="region"
      aria-label="Possible duplicate clients"
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <AlertCircle className={cn('h-4 w-4', hasHardConflict ? 'text-destructive' : 'text-amber-600')}/>
        {hasHardConflict
          ? 'This phone or email is already used'
          : 'Possible duplicate — does this person already exist?'}
      </div>

      <ul className="space-y-1.5">
        {data.map(c => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPickExisting(c)}
              className="w-full text-left flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-background transition"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.phone ?? '—'}{c.email ? ` · ${c.email}` : ''}
                </div>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-background border">
                {REASON_ICON[c.match_reason]}
                {REASON_LABEL[c.match_reason]}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Tap a row to open the existing client instead of creating a new one.
      </p>
    </div>
  );
};

export default SimilarClientSuggestions;
