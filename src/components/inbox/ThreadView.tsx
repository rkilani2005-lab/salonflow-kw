// src/components/inbox/ThreadView.tsx
import { useEffect, useRef } from "react";
import { ArrowLeft, CalendarPlus, Bot, X, Phone, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { ChannelBadge } from "./ChannelBadge";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { useConversation, setAiHandoff, closeConversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

type Props = { conversationId: string; onBack?: () => void };

export function ThreadView({ conversationId, onBack }: Props) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { data: conv, isLoading: loadingConv, refetch: refetchConv } = useConversation(conversationId);
  const { data: messages = [], isLoading: loadingMsgs } = useMessages(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const t = {
    book:   language === "ar" ? "احجز موعد"        : "Book appointment",
    ai:     language === "ar" ? "الرد الآلي"      : "AI autoreply",
    close:  language === "ar" ? "إغلاق المحادثة"  : "Close conversation",
    empty:  language === "ar" ? "ابدأ المحادثة"    : "Start the conversation",
    via:    language === "ar" ? "عبر"               : "via",
  };

  if (loadingConv || !conv) {
    return (
      <div className="flex-1 grid place-items-center">
        <div className="h-6 w-6 rounded-full border-2 border-[color:var(--brand-primary)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const name = conv.display_name || conv.external_id || "Unknown";

  const openBookFromChat = () => {
    // Deep link to the booking page with client info pre-filled.
    // Exact param names depend on your existing Booking page; adjust as needed.
    const q = new URLSearchParams({
      from: "inbox",
      conversation_id: conv.id,
      phone: conv.external_id || "",
      name: name,
    }).toString();
    navigate(`/calendar?${q}`);
  };

  const toggleAi = async (checked: boolean) => {
    await setAiHandoff(conv.id, checked);
    toast.success(checked ? "AI replies enabled" : "AI paused — replies are manual");
    refetchConv();
  };

  const onClose = async () => {
    await closeConversation(conv.id);
    toast.success(language === "ar" ? "تم إغلاق المحادثة" : "Conversation closed");
    onBack?.();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 md:px-4 h-14 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
        )}

        <div className="relative">
          <Avatar className="h-9 w-9">
            {conv.profile_pic_url && <AvatarImage src={conv.profile_pic_url} alt={name} />}
            <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -end-0.5 ring-2 ring-background rounded-full">
            <ChannelBadge channel={conv.channel} size="xs" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {t.via} <span className="capitalize">{conv.channel}</span>
            {conv.external_id && conv.channel === "whatsapp" && ` · +${conv.external_id}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {conv.channel === "whatsapp" && conv.external_id && (
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <a href={`tel:+${conv.external_id}`} aria-label="Call">
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          )}
          <Button onClick={openBookFromChat}
                  size="sm"
                  className="hidden sm:inline-flex h-8 gap-1.5"
                  style={{ backgroundColor: "var(--brand-primary, hsl(var(--primary)))",
                           color: "var(--brand-primary-fg, hsl(var(--primary-foreground)))" }}>
            <CalendarPlus className="h-3.5 w-3.5" />
            {t.book}
          </Button>
          <Button onClick={openBookFromChat} variant="ghost" size="icon" className="h-9 w-9 sm:hidden" aria-label={t.book}>
            <CalendarPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose} aria-label={t.close}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* AI autoreply toggle strip */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border/60 text-xs">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">{t.ai}</span>
        <Switch checked={conv.ai_handoff} onCheckedChange={toggleAi} className="ms-auto h-4 w-7" />
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 md:px-4 py-3">
        {loadingMsgs && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
                <div className="h-10 w-48 bg-muted rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        )}
        {!loadingMsgs && messages.length === 0 && (
          <div className="h-full min-h-[180px] grid place-items-center text-sm text-muted-foreground">
            {t.empty}
          </div>
        )}
        <div className="space-y-2">
          {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <Composer conversationId={conv.id} />
    </div>
  );
}
