// src/hooks/useMessages.ts
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { markConversationRead } from "./useConversations";

export type MessageRow = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  sender_type: "client" | "ai" | "staff" | "system";
  content_type: "text" | "image" | "audio" | "video" | "document" | "template" | "interactive" | "location" | "reaction";
  content: string | null;
  media_url: string | null;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  error_message: string | null;
  booking_id: string | null;
  created_at: string;
};

export function useMessages(conversationId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
  });

  // Realtime — insert-only subscription for this conversation
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          qc.setQueryData<MessageRow[]>(["messages", conversationId], (prev = []) => {
            if (prev.some(m => m.id === (payload.new as MessageRow).id)) return prev;
            return [...prev, payload.new as MessageRow];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          qc.setQueryData<MessageRow[]>(["messages", conversationId], (prev = []) =>
            prev.map(m => m.id === (payload.new as MessageRow).id ? (payload.new as MessageRow) : m),
          );
        },
      )
      .subscribe();

    // Mark read on open (fire-and-forget)
    markConversationRead(conversationId).catch(() => {});

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, qc]);

  return query;
}

export function useSendMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { text?: string; media_url?: string; media_type?: "image" | "video" | "document" }) => {
      if (!conversationId) throw new Error("no conversation");
      const { data, error } = await supabase.functions.invoke("channel-send", {
        body: { conversation_id: conversationId, ...args, sender_type: "staff" },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    },
  });
}
