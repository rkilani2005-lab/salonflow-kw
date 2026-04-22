// src/hooks/useConversations.ts
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ConversationRow = {
  id: string;
  tenant_id: string;
  channel: "whatsapp" | "instagram" | "telegram" | "linkedin";
  channel_account_id: string | null;
  provider_chat_id: string;
  external_id: string;
  display_name: string | null;
  profile_pic_url: string | null;
  client_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: "inbound" | "outbound" | null;
  unread_count: number;
  status: "open" | "pending" | "closed" | "spam";
  ai_handoff: boolean;
  assigned_to: string | null;
};

type Filter = {
  channel?: "whatsapp" | "instagram" | "all";
  status?: "open" | "closed" | "all";
  search?: string;
};

export function useConversations(filter: Filter = {}) {
  const { tenant_id } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", tenant_id, filter],
    enabled: !!tenant_id,
    queryFn: async () => {
      let q = supabase
        .from("conversations")
        .select("*")
        .eq("tenant_id", tenant_id!)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100);

      if (filter.channel && filter.channel !== "all") q = q.eq("channel", filter.channel);
      if (filter.status === "open")   q = q.eq("status", "open");
      if (filter.status === "closed") q = q.eq("status", "closed");
      if (filter.search?.trim()) {
        const s = `%${filter.search.trim()}%`;
        q = q.or(`display_name.ilike.${s},last_message_preview.ilike.${s},external_id.ilike.${s}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ConversationRow[];
    },
  });

  // Live updates — invalidate query on any change to this tenant's conversations
  useEffect(() => {
    if (!tenant_id) return;
    const channel = supabase
      .channel(`conversations:${tenant_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `tenant_id=eq.${tenant_id}` },
        () => qc.invalidateQueries({ queryKey: ["conversations", tenant_id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant_id, qc]);

  return query;
}

export function useConversation(conversationId: string | null) {
  const { tenant_id } = useAuth();
  return useQuery({
    queryKey: ["conversation", conversationId],
    enabled: !!conversationId && !!tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, clients(id, name, phone)")
        .eq("id", conversationId!)
        .single();
      if (error) throw error;
      return data as ConversationRow & { clients?: { id: string; name: string; phone: string } };
    },
  });
}

export async function markConversationRead(id: string) {
  await supabase.from("conversations").update({ unread_count: 0 }).eq("id", id);
}

export async function setAiHandoff(id: string, enabled: boolean) {
  await supabase.from("conversations").update({ ai_handoff: enabled }).eq("id", id);
}

export async function closeConversation(id: string, closed = true) {
  await supabase.from("conversations").update({ status: closed ? "closed" : "open" }).eq("id", id);
}
