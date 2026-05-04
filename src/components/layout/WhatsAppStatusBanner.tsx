import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { useWhatsAppStatus } from '@/hooks/useChannelAccounts';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

/**
 * D.8 — Disconnection banner.
 *
 * Renders ONLY when the tenant has a WhatsApp channel that has
 * previously connected (so we know this is a regression, not a
 * never-set-up state) and is now in disconnected / error / expired.
 *
 * Hidden:
 *   - on /settings (the user is already where they need to go to fix it)
 *   - on /auth (the user isn't signed in yet anyway)
 *   - while loading (avoid flicker on first paint)
 *   - if the user has dismissed it this session (sessionStorage)
 *
 * Tap → navigates to Settings → Channels tab pre-selected via
 * ?tab=channels query param.
 */

const DISMISS_KEY = 'zaina_wa_banner_dismissed';

export function WhatsAppStatusBanner() {
  const { account, isUnhealthy, lastError, loading } = useWhatsAppStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  if (loading) return null;
  if (!isUnhealthy) return null;
  // Only banner accounts that have ever connected — a tenant who
  // hasn't set up WhatsApp yet doesn't need a regression alarm.
  if (!account?.connected_at) return null;
  if (dismissed) return null;
  if (location.pathname.startsWith('/settings')) return null;
  if (location.pathname.startsWith('/auth'))     return null;

  const handleFix = () => {
    navigate('/settings?tab=channels');
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
    setDismissed(true);
  };

  // Status-specific copy.  'expired' typically means the phone has
  // been offline 14+ days and WhatsApp invalidated the session.
  // 'error' is the bridge reporting an unexpected failure.
  const headline = (() => {
    if (account.status === 'expired') return ar
      ? 'انتهت جلسة واتساب — أعد ربط الجهاز'
      : 'WhatsApp session expired — re-pair your phone';
    if (account.status === 'error')   return ar
      ? 'مشكلة في اتصال واتساب — يرجى إعادة الربط'
      : 'WhatsApp connection error — re-pair to restore';
    return ar
      ? 'انقطع الاتصال بواتساب — لن يصل أي رسائل حتى إعادة الربط'
      : 'WhatsApp disconnected — messages will not arrive until you re-pair';
  })();

  return (
    <div
      onClick={handleFix}
      className={cn(
        'flex items-center gap-3 px-4 py-2 cursor-pointer',
        'bg-amber-50 dark:bg-amber-950/30',
        'border-b border-amber-200 dark:border-amber-800',
        'text-amber-900 dark:text-amber-100',
        'hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors',
      )}
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-tight truncate">{headline}</p>
        {lastError && (
          <p className="text-[10px] opacity-70 truncate mt-0.5">
            {ar ? 'التفاصيل: ' : 'Details: '}{lastError}
          </p>
        )}
      </div>
      <span className="text-[11px] font-bold underline-offset-2 hover:underline whitespace-nowrap">
        {ar ? 'إصلاح الآن ←' : 'Fix now →'}
      </span>
      <button
        onClick={handleDismiss}
        className="p-1 rounded hover:bg-amber-200/60 dark:hover:bg-amber-900/60"
        aria-label={ar ? 'إغلاق' : 'Dismiss'}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
