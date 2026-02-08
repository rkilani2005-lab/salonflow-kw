-- Create enum types for WhatsApp system
CREATE TYPE whatsapp_conversation_type AS ENUM ('customer', 'admin');
CREATE TYPE whatsapp_message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE whatsapp_detected_language AS ENUM ('en', 'ar');
CREATE TYPE whatsapp_message_type AS ENUM ('text', 'voice', 'booking_offer', 'report', 'handoff');

-- 1. WhatsApp Config - Tenant-specific settings
CREATE TABLE public.whatsapp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  voice_enabled BOOLEAN NOT NULL DEFAULT true,
  owner_phone_numbers TEXT[] DEFAULT '{}',
  staff_phone_numbers TEXT[] DEFAULT '{}',
  welcome_message_en TEXT DEFAULT 'Welcome to our salon! How can I help you today?',
  welcome_message_ar TEXT DEFAULT 'أهلاً وسهلاً بك في صالوننا! كيف يمكنني مساعدتك اليوم؟',
  max_retry_attempts INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_tenant_config UNIQUE (tenant_id)
);

-- 2. WhatsApp Conversations - Chat history and state
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  conversation_type whatsapp_conversation_type NOT NULL DEFAULT 'customer',
  conversation_state JSONB DEFAULT '{}',
  needs_human_intervention BOOLEAN NOT NULL DEFAULT false,
  intervention_reason TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. WhatsApp Messages - Individual message log
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction whatsapp_message_direction NOT NULL,
  message_content TEXT NOT NULL,
  detected_language whatsapp_detected_language DEFAULT 'en',
  message_type whatsapp_message_type NOT NULL DEFAULT 'text',
  original_audio_url TEXT,
  transcription TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Expenses - For owner expense tracking queries
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10, 3) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_whatsapp_conversations_tenant ON public.whatsapp_conversations(tenant_id);
CREATE INDEX idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone_number);
CREATE INDEX idx_whatsapp_conversations_intervention ON public.whatsapp_conversations(needs_human_intervention) WHERE needs_human_intervention = true;
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);
CREATE INDEX idx_expenses_tenant ON public.expenses(tenant_id);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);

-- Enable RLS on all tables
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_config
CREATE POLICY "Users can view their tenant's WhatsApp config"
  ON public.whatsapp_config
  FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners and managers can update WhatsApp config"
  ON public.whatsapp_config
  FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Owners and managers can insert WhatsApp config"
  ON public.whatsapp_config
  FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  );

-- RLS Policies for whatsapp_conversations
CREATE POLICY "Users can view their tenant's conversations"
  ON public.whatsapp_conversations
  FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Service role can insert conversations"
  ON public.whatsapp_conversations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update conversations"
  ON public.whatsapp_conversations
  FOR UPDATE
  USING (true);

-- RLS Policies for whatsapp_messages
CREATE POLICY "Users can view messages in their tenant's conversations"
  ON public.whatsapp_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_conversations c
      WHERE c.id = conversation_id
      AND c.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Service role can insert messages"
  ON public.whatsapp_messages
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for expenses
CREATE POLICY "Users can view their tenant's expenses"
  ON public.expenses
  FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners and managers can manage expenses"
  ON public.expenses
  FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'accountant'))
  );

-- Trigger for updated_at on whatsapp_config
CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;