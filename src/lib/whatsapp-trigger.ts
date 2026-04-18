import { supabase as _supabase } from '@/integrations/supabase/client';

// Cast to any — whatsapp_triggers columns use flexible JSON for conditions
// and app code predates the typed client for this table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

/**
 * Fire a configured WhatsApp trigger for a tenant-scoped event.
 *
 * BACKGROUND
 * whatsapp_triggers is a configuration table: for each (tenant, event_type)
 * a tenant can toggle whether to send, which template, how long to delay,
 * and who to send to.  Before this helper was added, NO code in the app
 * read this table or sent messages based on it.  Users could toggle the
 * switches in the UI, but nothing happened.  Five of the six configured
 * trigger types have been silently non-functional since launch
 * (booking_confirmed, reminder_24h, reminder_1h, booking_cancelled,
 * receipt_sent, reengagement — only po_sent worked because that path
 * directly invoked the edge function rather than going through triggers).
 *
 * SCOPE
 * This helper dispatches IMMEDIATE triggers (delay_minutes = 0) inline.
 * Delayed triggers (reminder_24h, reminder_1h, reengagement) require a
 * scheduler — either a Supabase scheduled function or pg_cron.  When a
 * delayed trigger is encountered, we log it rather than send
 * immediately, since sending immediately would violate the configured
 * delay.  A scheduler job can consume these log entries.
 *
 * FAILURE MODE
 * Best-effort.  Any error is swallowed and logged to console.warn —
 * WhatsApp dispatch must never block or abort the business action
 * (booking save, checkout, etc.) that triggered it.
 */
export async function fireWhatsAppTrigger(args: {
  tenant_id:       string;
  event_type:      'booking_confirmed' | 'booking_cancelled' | 'receipt_sent'
                 | 'reminder_24h'       | 'reminder_1h'       | 'reengagement';
  phone_number:    string | null | undefined;
  variables?:      Record<string, string>;
  reference_id?:   string;
  reference_type?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!args.phone_number) {
      return { sent: false, reason: 'no_phone' };
    }

    // Fetch active trigger for this event.  Note: the column is `event`
    // in the current schema (migration 20260411114834 renamed from the
    // earlier `event_type`).  Similarly `is_enabled`, not `is_active`.
    const { data: trigger, error } = await supabase
      .from('whatsapp_triggers')
      .select('id, is_enabled, delay_minutes, template_id, target_audience')
      .eq('tenant_id',  args.tenant_id)
      .eq('event',      args.event_type)
      .eq('is_enabled', true)
      .maybeSingle();
    if (error || !trigger) {
      return { sent: false, reason: 'no_trigger' };
    }

    // Delayed triggers must go through a scheduler, not fire now.
    // whatsapp_sent_log lacks a scheduled_at column, so we can't
    // cleanly persist the deferred message.  For now we log to the
    // console; when a scheduler arrives (Supabase scheduled function
    // or pg_cron), extend whatsapp_sent_log with scheduled_at +
    // status='deferred' and revisit.
    if (Number(trigger.delay_minutes) > 0) {
      console.info(
        `[WhatsApp] Deferred trigger ${args.event_type} (+${trigger.delay_minutes}min) — scheduler not yet implemented; no message sent.`,
        { reference_id: args.reference_id, reference_type: args.reference_type },
      );
      return { sent: false, reason: 'deferred' };
    }

    // Immediate dispatch via the existing edge function.
    await supabase.functions.invoke('whatsapp-send', {
      body: {
        tenant_id:      args.tenant_id,
        event_type:     args.event_type,
        phone_number:   args.phone_number,
        variables:      args.variables ?? {},
        reference_id:   args.reference_id,
        reference_type: args.reference_type,
      },
    });

    return { sent: true };
  } catch (e) {
    console.warn('[WhatsApp] Trigger dispatch failed (non-fatal):', e);
    return { sent: false, reason: 'error' };
  }
}
