// src/components/inbox/Composer.tsx
import { useState, KeyboardEvent, useRef } from "react";
import { Send, Smile, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useSendMessage } from "@/hooks/useMessages";
import { useLanguage } from "@/contexts/LanguageContext";

type Props = { conversationId: string; disabled?: boolean };

export function Composer({ conversationId, disabled }: Props) {
  const { language } = useLanguage();
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const send = useSendMessage(conversationId);

  const placeholder = disabled
    ? (language === "ar" ? "هذه القناة غير متصلة" : "Channel disconnected")
    : (language === "ar" ? "اكتب رسالة..." : "Type a message…");

  const onSubmit = async () => {
    const t = text.trim();
    if (!t || send.isPending || disabled) return;
    setText("");
    try {
      await send.mutateAsync({ text: t });
      taRef.current?.focus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
      setText(t); // restore so user can retry
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="border-t border-border/60 bg-background p-3">
      <div className="flex items-end gap-2 rounded-2xl bg-muted/40 px-3 py-2 ring-1 ring-border/40 focus-within:ring-2 focus-within:ring-[color:var(--brand-primary,hsl(var(--primary)))]/40 transition">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground"
                aria-label="emoji" disabled>
          <Smile className="h-4 w-4" />
        </Button>
        <Textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 min-h-[32px] max-h-32 resize-none border-0 bg-transparent p-0 text-sm
                     shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!text.trim() || send.isPending || disabled}
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          style={{ backgroundColor: "var(--brand-primary, hsl(var(--primary)))",
                   color: "var(--brand-primary-fg, hsl(var(--primary-foreground)))" }}
          aria-label={language === "ar" ? "إرسال" : "Send"}
        >
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
