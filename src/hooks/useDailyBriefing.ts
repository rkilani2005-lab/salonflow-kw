import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DailyBriefingConfig {
  tenant_id: string;
  enabled: boolean;
  send_hour: number;
  recipient_phone: string | null;
  last_sent_date: string | null;
  last_brief: string | null;
}

export function useDailyBriefing() {
  const { tenant } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["daily-briefing", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("daily_briefing_config")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .maybeSingle();
      if (error) throw error;
      return data as DailyBriefingConfig | null;
    },
  });

  const saveMut = useMutation({
    mutationFn: async (patch: Partial<DailyBriefingConfig>) => {
      const payload = { tenant_id: tenant!.id, ...patch };
      const { error } = await (supabase as any)
        .from("daily_briefing_config")
        .upsert(payload, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-briefing", tenant?.id] }),
  });

  const sendNowMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).functions.invoke("daily-briefing", { body: {} });
      if (error) throw error;
      return data;
    },
  });

  return {
    config: query.data,
    isLoading: query.isLoading,
    save: saveMut.mutateAsync,
    sendNow: sendNowMut.mutateAsync,
  };
}
