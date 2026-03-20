-- ============================================================
-- WhatsApp Business API Enhancement
-- Adds Meta credentials, message templates, and trigger system
-- ============================================================

-- ── 1. Add Meta credential fields to whatsapp_config ─────────
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS phone_number_id        TEXT,
  ADD COLUMN IF NOT EXISTS waba_id                TEXT,
  ADD COLUMN IF NOT EXISTS access_token           TEXT,
  ADD COLUMN IF NOT EXISTS webhook_verify_token   TEXT DEFAULT 'zaina_webhook_' || gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS connection_status      TEXT DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS last_connected_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS business_name          TEXT,
  ADD COLUMN IF NOT EXISTS display_phone_number   TEXT;

-- ── 2. Message Templates ──────────────────────────────────────
-- Stores both custom messages and Meta-approved templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,             -- internal name
  template_name   TEXT,                      -- Meta template name (after approval)
  category        TEXT NOT NULL DEFAULT 'UTILITY',
  trigger_event   TEXT NOT NULL,             -- booking_confirmed, reminder_24h, receipt, etc.
  is_active       BOOLEAN NOT NULL DEFAULT true,
  -- Message body (supports variables: {{client_name}}, {{service}}, {{date}}, {{time}}, {{amount}})
  body_en         TEXT NOT NULL,
  body_ar         TEXT,
  -- Optional header and footer
  header_text     TEXT,
  footer_text     TEXT,
  -- Meta approval status
  meta_status     TEXT DEFAULT 'local',      -- local | pending | approved | rejected
  meta_template_id TEXT,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. WhatsApp Triggers (event → message mapping) ───────────
CREATE TABLE IF NOT EXISTS public.whatsapp_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,    -- booking_confirmed, booking_cancelled, reminder_24h,
                                    -- reminder_1h, receipt_sent, custom_campaign
  template_id     UUID REFERENCES public.whatsapp_templates(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  delay_minutes   INTEGER NOT NULL DEFAULT 0,   -- send X mins after event (0 = immediate)
  send_to         TEXT NOT NULL DEFAULT 'client', -- client | staff | owner | all
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. Sent Messages Log ─────────────────────────────────────
-- Tracks every outbound triggered message for deduplication
CREATE TABLE IF NOT EXISTS public.whatsapp_sent_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  trigger_id      UUID REFERENCES public.whatsapp_triggers(id),
  template_id     UUID REFERENCES public.whatsapp_templates(id),
  reference_id    UUID,              -- booking_id, transaction_id, etc.
  reference_type  TEXT,              -- booking, transaction, campaign
  phone_number    TEXT NOT NULL,
  message_body    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'sent',  -- sent | delivered | read | failed
  meta_message_id TEXT,              -- WhatsApp message ID from Meta response
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message   TEXT
);

-- ── 5. Seed default templates for new tenants ────────────────
CREATE OR REPLACE FUNCTION public.seed_whatsapp_templates(p_tenant_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.whatsapp_templates
    (tenant_id, name, trigger_event, category, body_en, body_ar, footer_text)
  VALUES
  (p_tenant_id,
   'Booking Confirmation',
   'booking_confirmed', 'UTILITY',
   '✅ *Booking Confirmed!*

Hi {{client_name}}! Your appointment is confirmed:

📋 *Service:* {{service}}
📅 *Date:* {{date}}
🕐 *Time:* {{time}}
💇‍♀️ *Stylist:* {{staff}}

See you soon! Reply to reschedule or cancel.',
   '✅ *تم تأكيد الحجز!*

أهلاً {{client_name}}! تم تأكيد موعدك:

📋 *الخدمة:* {{service}}
📅 *التاريخ:* {{date}}
🕐 *الوقت:* {{time}}
💇‍♀️ *الموظفة:* {{staff}}

نراكِ قريباً! ردي لإعادة الجدولة أو الإلغاء.',
   'Powered by ZAINA'),

  (p_tenant_id,
   '24-Hour Reminder',
   'reminder_24h', 'UTILITY',
   '🔔 *Reminder — Tomorrow!*

Hi {{client_name}}, just a friendly reminder:

📅 *{{date}}* at *{{time}}*
💇‍♀️ {{service}} with {{staff}}

We look forward to seeing you! 💅',
   '🔔 *تذكير — الغد!*

مرحباً {{client_name}}، تذكير بموعدك:

📅 *{{date}}* الساعة *{{time}}*
💇‍♀️ {{service}} مع {{staff}}

نتطلع لرؤيتك! 💅',
   NULL),

  (p_tenant_id,
   '1-Hour Reminder',
   'reminder_1h', 'UTILITY',
   '⏰ *See you soon!*

Hi {{client_name}}, your appointment is in *1 hour*:

🕐 {{time}} — {{service}}

We''re getting ready for you! ✨',
   '⏰ *نراكِ قريباً!*

مرحباً {{client_name}}، موعدكِ بعد *ساعة واحدة*:

🕐 {{time}} — {{service}}

نستعد لاستقبالكِ! ✨',
   NULL),

  (p_tenant_id,
   'Booking Cancellation',
   'booking_cancelled', 'UTILITY',
   '❌ *Booking Cancelled*

Hi {{client_name}}, your appointment has been cancelled:

📅 {{date}} at {{time}} — {{service}}

Book again anytime at {{booking_link}} or reply here.',
   '❌ *تم إلغاء الحجز*

مرحباً {{client_name}}، تم إلغاء موعدكِ:

📅 {{date}} الساعة {{time}} — {{service}}

احجزي مجدداً في أي وقت أو ردي هنا.',
   NULL),

  (p_tenant_id,
   'Payment Receipt',
   'receipt_sent', 'UTILITY',
   '🧾 *Payment Receipt*

Thank you, {{client_name}}! ❤️

Services: {{services_list}}
Total: *{{amount}} KWD*
Paid via: {{payment_method}}
Date: {{date}}

Thank you for visiting us! We hope to see you again soon. 💅✨',
   '🧾 *إيصال الدفع*

شكراً لكِ {{client_name}}! ❤️

الخدمات: {{services_list}}
الإجمالي: *{{amount}} KWD*
طريقة الدفع: {{payment_method}}
التاريخ: {{date}}

شكراً لزيارتكِ! نتمنى رؤيتكِ مجدداً قريباً. 💅✨',
   NULL),

  (p_tenant_id,
   'We Miss You',
   'reengagement', 'MARKETING',
   '💕 *We miss you, {{client_name}}!*

It''s been a while since your last visit. We have some amazing new services and offers just for you!

Book now and get a warm welcome back. 🌹',
   '💕 *اشتقنا إليكِ، {{client_name}}!*

مرّ وقت منذ آخر زيارة. لدينا خدمات وعروض رائعة خصيصاً لكِ!

احجزي الآن واستمتعي بعودة دافئة. 🌹',
   NULL)

  ON CONFLICT DO NOTHING;
END;
$$;

-- ── 6. Seed default triggers ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_whatsapp_triggers(p_tenant_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_confirmed_tpl  UUID;
  v_reminder24_tpl UUID;
  v_reminder1h_tpl UUID;
  v_cancelled_tpl  UUID;
  v_receipt_tpl    UUID;
BEGIN
  SELECT id INTO v_confirmed_tpl  FROM public.whatsapp_templates WHERE tenant_id=p_tenant_id AND trigger_event='booking_confirmed'  LIMIT 1;
  SELECT id INTO v_reminder24_tpl FROM public.whatsapp_templates WHERE tenant_id=p_tenant_id AND trigger_event='reminder_24h'       LIMIT 1;
  SELECT id INTO v_reminder1h_tpl FROM public.whatsapp_templates WHERE tenant_id=p_tenant_id AND trigger_event='reminder_1h'        LIMIT 1;
  SELECT id INTO v_cancelled_tpl  FROM public.whatsapp_templates WHERE tenant_id=p_tenant_id AND trigger_event='booking_cancelled'  LIMIT 1;
  SELECT id INTO v_receipt_tpl    FROM public.whatsapp_templates WHERE tenant_id=p_tenant_id AND trigger_event='receipt_sent'       LIMIT 1;

  INSERT INTO public.whatsapp_triggers (tenant_id, event_type, template_id, is_active, delay_minutes, send_to)
  VALUES
    (p_tenant_id, 'booking_confirmed', v_confirmed_tpl,  true, 0,    'client'),
    (p_tenant_id, 'reminder_24h',      v_reminder24_tpl, true, 0,    'client'),
    (p_tenant_id, 'reminder_1h',       v_reminder1h_tpl, true, 0,    'client'),
    (p_tenant_id, 'booking_cancelled', v_cancelled_tpl,  true, 0,    'client'),
    (p_tenant_id, 'receipt_sent',      v_receipt_tpl,    false, 0,   'client')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── 7. Indexes & RLS ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_templates_tenant ON public.whatsapp_templates(tenant_id, trigger_event);
CREATE INDEX IF NOT EXISTS idx_wa_triggers_tenant  ON public.whatsapp_triggers(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_wa_sent_log_ref     ON public.whatsapp_sent_log(reference_id, reference_type);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_triggers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sent_log  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access to whatsapp_templates"
ON public.whatsapp_templates FOR ALL TO authenticated
USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=whatsapp_templates.tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=whatsapp_templates.tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant access to whatsapp_triggers"
ON public.whatsapp_triggers FOR ALL TO authenticated
USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=whatsapp_triggers.tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=whatsapp_triggers.tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant access to whatsapp_sent_log"
ON public.whatsapp_sent_log FOR ALL TO authenticated
USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=whatsapp_sent_log.tenant_id) OR is_super_admin(auth.uid()))
WITH CHECK (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.tenant_id=whatsapp_sent_log.tenant_id) OR is_super_admin(auth.uid()));

-- updated_at trigger
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
