import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SimulatorMessage } from '@/types/whatsapp';
import { toast } from 'sonner';

export function useWhatsAppSimulator(mode: 'customer' | 'admin') {
  const [messages, setMessages] = useState<SimulatorMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (content: string, type: 'text' | 'voice' = 'text') => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: SimulatorMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      type,
      language: detectLanguage(content),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Get user's tenant ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      // Call the WhatsApp agent function
      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: {
          phoneNumber: mode === 'admin' ? '+965-OWNER-SIM' : '+965-CUSTOMER-SIM',
          messageContent: content,
          messageType: type,
          tenantId: profile?.tenant_id,
          simulatorMode: true,
        },
      });

      if (error) throw error;

      // Add AI response
      const assistantMessage: SimulatorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data?.reply || 'Sorry, I could not process your request.',
        type: 'text',
        language: data?.language || 'en',
        timestamp: new Date(),
        metadata: data?.metadata,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Simulator error:', error);
      toast.error('Failed to get AI response');
      
      // Add error message
      const errorMessage: SimulatorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        type: 'text',
        language: 'en',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
}

function detectLanguage(text: string): 'en' | 'ar' {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return arabicPattern.test(text) ? 'ar' : 'en';
}
