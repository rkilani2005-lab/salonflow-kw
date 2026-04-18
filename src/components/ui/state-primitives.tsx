import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, RefreshCw, LucideIcon, Inbox } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────
   SalonFlow shared state primitives
   ──────────────────────────────────────────────────────────────
   Purpose: one visual language for empty / loading / error across
   all 30 pages. Zero business logic. Zero inline styles.
   All spacing & colours route through design tokens.
─────────────────────────────────────────────────────────────── */

/* ── EMPTY STATE ─────────────────────────────────────────────── */

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  /** Use `compact` inside cards/tabs; `default` for full pages. */
  size?: 'compact' | 'default';
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  size = 'default',
  className,
}: EmptyStateProps) {
  const compact = size === 'compact';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-10 px-4' : 'py-20 px-6',
        className,
      )}
    >
      <div
        className={cn(
          'rounded-full bg-muted/60 flex items-center justify-center mb-4',
          compact ? 'h-12 w-12' : 'h-16 w-16',
        )}
      >
        <Icon
          className={cn(
            'text-muted-foreground',
            compact ? 'h-5 w-5' : 'h-7 w-7',
          )}
        />
      </div>
      <h3
        className={cn(
          'font-semibold text-foreground tracking-tight',
          compact ? 'text-sm' : 'text-base',
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            'text-muted-foreground mt-1 max-w-sm',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex gap-2 mt-5">
          {action && (
            <Button size={compact ? 'sm' : 'default'} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              size={compact ? 'sm' : 'default'}
              variant="outline"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── LOADING SKELETONS ───────────────────────────────────────── */

/**
 * Generic loading state. For most lists — use rows.
 * For dashboards / reports — use cards.
 */
export function LoadingState({
  variant = 'rows',
  rows = 5,
  className,
}: {
  variant?: 'rows' | 'cards' | 'table' | 'detail';
  rows?: number;
  className?: string;
}) {
  if (variant === 'cards') {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-md border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('rounded-md border overflow-hidden', className)}>
        <div className="bg-muted/50 border-b px-4 py-3 flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-24" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-b last:border-0 px-4 py-4 flex gap-4 items-center">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16 ms-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className={cn('space-y-6 p-6', className)}>
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  /* default: rows */
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-md border bg-card">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

/* ── ERROR STATE ─────────────────────────────────────────────── */

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  size?: 'compact' | 'default';
  className?: string;
  /** Extra actions beyond retry (e.g. "Contact support") */
  children?: ReactNode;
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  error,
  onRetry,
  size = 'default',
  className,
  children,
}: ErrorStateProps) {
  const compact = size === 'compact';
  const errMsg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : undefined;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-10 px-4' : 'py-16 px-6',
        className,
      )}
    >
      <div
        className={cn(
          'rounded-full bg-destructive/10 flex items-center justify-center mb-4',
          compact ? 'h-12 w-12' : 'h-16 w-16',
        )}
      >
        <AlertTriangle
          className={cn(
            'text-destructive',
            compact ? 'h-5 w-5' : 'h-7 w-7',
          )}
        />
      </div>
      <h3
        className={cn(
          'font-semibold text-foreground tracking-tight',
          compact ? 'text-sm' : 'text-base',
        )}
      >
        {title}
      </h3>
      {(description || errMsg) && (
        <p
          className={cn(
            'text-muted-foreground mt-1 max-w-md',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {description ?? errMsg}
        </p>
      )}
      <div className="flex gap-2 mt-5">
        {onRetry && (
          <Button
            size={compact ? 'sm' : 'default'}
            variant="outline"
            onClick={onRetry}
          >
            <RefreshCw className="h-3.5 w-3.5 me-2" />
            Try again
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}

/* ── AsyncSection — convenience wrapper ──────────────────────── */

/**
 * Wraps an async block with standardised loading / error / empty handling.
 * Usage:
 *   <AsyncSection
 *     loading={isLoading} error={error} empty={data?.length === 0}
 *     emptyState={{ icon: Users, title: 'No clients yet', action: {...} }}
 *   >
 *     {data.map(...)}
 *   </AsyncSection>
 */
export function AsyncSection({
  loading,
  error,
  empty,
  loadingVariant,
  loadingRows,
  emptyState,
  onRetry,
  children,
  className,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  loadingVariant?: 'rows' | 'cards' | 'table' | 'detail';
  loadingRows?: number;
  emptyState?: Omit<EmptyStateProps, 'size'>;
  onRetry?: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (loading) return <LoadingState variant={loadingVariant} rows={loadingRows} className={className} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} className={className} />;
  if (empty && emptyState) return <EmptyState {...emptyState} className={className} />;
  return <>{children}</>;
}
