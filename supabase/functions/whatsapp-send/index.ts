/**
 * whatsapp-send — Outbound message dispatcher
 *
 * Called by:
 *  - Booking events (confirmation, reminder, cancellation)
 *  - POS checkout (receipt)
 *  - Manual campaigns
 *  - Test connections from settings UI
 *
 * POST body:
 * {
 *   tenant_id: string
 *   event_type: string          // booking_confirmed | reminder_24h | receipt_sent | test | ...
 *   phone_number: string        // recipient E.164 format (+96599XXXXXX)
 *   variables: Record<string, string>  // template variable substitution
 *   reference_id?: string
 *   reference_type?: string
 *   language?: 'en' | 'ar'
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { tenant_id, event_type, phone_number, variables = {}, reference_id, reference_type, language } = body;

    if (!tenant_id || !phone_number) {
      return json({ error: 'tenant_id and phone_number are required' }, 400);
    }

    // ── 1. Load tenant WhatsApp config ─────────────────────────
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single();

    if (!config?.phone_number_id || !config?.access_token) {
      return json({ error: 'WhatsApp not configured for this tenant' }, 400);
    }

    if (!config.is_enabled && event_type !== 'test') {
      return json({ error: 'WhatsApp is disabled for this tenant' }, 400);
    }

    // ── 2. Find matching trigger + template ─────────────────────
    let messageBody: string;

    if (event_type === 'test') {
      // Simple test message
      messageBody = `🟢 *ZAINA WhatsApp Connected!*\n\nYour WhatsApp Business number is active and ready.\n\nPowered by ZAINA Salon Management 💅`;
    } else {
      // Find active trigger for this event
      const { data: trigger } = await supabase
        .from('whatsapp_triggers')
        .select('*, template:whatsapp_templates(*)')
        .eq('tenant_id', tenant_id)
        .eq('event_type', event_type)
        .eq('is_active', true)
        .single();

      if (!trigger?.template) {
        return json({ error: `No active template for event: ${event_type}` }, 400);
      }

      // Choose language — detect from client record or use param
      const tpl = trigger.template;
      const useAr = language === 'ar' || (language !== 'en' && tpl.body_ar);
      const rawBody = (useAr && tpl.body_ar) ? tpl.body_ar : tpl.body_en;

      // Substitute variables
      messageBody = rawBody.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
        return variables[key] || `{{${key}}}`;
      });

      // Log sent message
      await supabase.from('whatsapp_sent_log').insert({
        tenant_id,
        trigger_id: trigger.id,
        template_id: tpl.id,
        reference_id: reference_id || null,
        reference_type: reference_type || null,
        phone_number,
        message_body: messageBody,
        status: 'sending',
      });
    }

    // ── 3. Send via Meta Graph API ──────────────────────────────
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone_number.replace(/\D/g, ''), // strip non-digits
          type: 'text',
          text: { body: messageBody, preview_url: false },
        }),
      }
    );

    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      const errMsg = metaData?.error?.message || `Meta API error ${metaRes.status}`;
      console.error('Meta send error:', JSON.stringify(metaData));

      // Update log with failure
      if (reference_id) {
        await supabase.from('whatsapp_sent_log')
          .update({ status: 'failed', error_message: errMsg })
          .eq('reference_id', reference_id)
          .eq('phone_number', phone_number);
      }

      return json({ error: errMsg }, 400);
    }

    const metaMessageId = metaData?.messages?.[0]?.id;

    // Update log with success + Meta message ID
    if (reference_id && metaMessageId) {
      await supabase.from('whatsapp_sent_log')
        .update({ status: 'sent', meta_message_id: metaMessageId })
        .eq('reference_id', reference_id)
        .eq('phone_number', phone_number);
    }

    return json({ success: true, message_id: metaMessageId });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('whatsapp-send error:', msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
