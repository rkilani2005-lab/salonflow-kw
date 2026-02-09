export interface WhatsAppConfig {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  voice_enabled: boolean;
  owner_phone_numbers: string[];
  staff_phone_numbers: string[];
  welcome_message_en: string;
  welcome_message_ar: string;
  max_retry_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppConversation {
  id: string;
  tenant_id: string;
  phone_number: string;
  conversation_type: 'customer' | 'admin';
  conversation_state: Record<string, any>;
  needs_human_intervention: boolean;
  intervention_reason: string | null;
  last_message_at: string;
  created_at: string;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  message_content: string;
  detected_language: 'en' | 'ar';
  message_type: 'text' | 'voice' | 'booking_offer' | 'report' | 'handoff';
  original_audio_url: string | null;
  transcription: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SimulatorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'voice';
  language: 'en' | 'ar';
  timestamp: Date;
  metadata?: Record<string, any>;
}
