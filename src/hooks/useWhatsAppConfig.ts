import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WhatsAppConfig } from '@/types/whatsapp';

export function useWhatsAppConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => {
      // First get the user's tenant ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.tenant_id) throw new Error('No tenant found');

      // Get the config
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('id, tenant_id, is_enabled, voice_enabled, owner_phone_numbers, staff_phone_numbers, welcome_message_en, welcome_message_ar, max_retry_attempts')
        .eq('tenant_id', profile.tenant_id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Return existing config or create default
      if (!data) {
        const { data: newConfig, error: createError } = await supabase
          .from('whatsapp_config')
          .insert({
            tenant_id: profile.tenant_id,
            is_enabled: false,
            voice_enabled: true,
            owner_phone_numbers: [],
            staff_phone_numbers: [],
            welcome_message_en: 'Welcome to our salon! How can I help you today?',
            welcome_message_ar: 'أهلاً وسهلاً بك في صالوننا! كيف يمكنني مساعدتك اليوم؟',
            max_retry_attempts: 2,
          })
          .select()
          .single();

        if (createError) throw createError;
        return newConfig as WhatsAppConfig;
      }

      return data as WhatsAppConfig;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<WhatsAppConfig>) => {
      if (!config?.id) throw new Error('No config found');

      const { data, error } = await supabase
        .from('whatsapp_config')
        .update(updates)
        .eq('id', config.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      toast.success('Settings saved successfully');
    },
    onError: (error) => {
      console.error('Failed to update config:', error);
      toast.error('Failed to save settings');
    },
  });

  return {
    config,
    isLoading,
    error,
    updateConfig: updateConfig.mutate,
    isUpdating: updateConfig.isPending,
  };
}
