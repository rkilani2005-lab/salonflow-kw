// src/components/inbox/MessageBubble.tsx
import { cn } from "@/lib/utils";
import { Check, CheckCheck, AlertCircle, Bot } from "lucide-react";
import type { MessageRow } from "@/hooks/useMessages";

type Props = { msg: MessageRow };

function time(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function StatusIcon({ status }: { status: MessageRow["status"] }) {
  switch (status) {
    case "queued":    return <Check    className="h-3 w-3 opacity-40" />;
    case "sent":      return <Check    className="h-3 w-3 opacity-60" />;
    case "delivered": return <CheckCheck className="h-3 w-3 opacity-60" />;
    case "read":      return <CheckCheck className="h-3 w-3 text-[color:var(--brand-primary)]" />;
    case "failed":    return <AlertCircle className="h-3 w-3 text-destructive" />;
  }
}

export function MessageBubble({ msg }: Props) {
  const outbound = msg.direction === "outbound";
  const ai       = msg.sender_type === "ai";
  const isMedia  = msg.content_type !== "text" && msg.media_url;

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[78%] rounded-2xl px-3 py-2 shadow-sm",
        outbound
          ? ai
            ? "bg-[color:var(--brand-accent,theme(colors.accent.DEFAULT))] text-foreground rounded-br-sm"
            : "bg-[color:var(--brand-primary,hsl(var(--primary)))] text-[color:var(--brand-primary-fg,hsl(var(--primary-foreground)))] rounded-br-sm"
          : "bg-muted text-foreground rounded-bl-sm",
      )}>
        {/* AI label */}
        {ai && outbound && (
          <div className="flex items-center gap-1 mb-1 text-[10px] font-medium opacity-70">
            <Bot className="h-3 w-3" /> AI assistant
          </div>
        )}

        {/* Media preview */}
        {isMedia && msg.media_url && (msg.content_type === "image" ? (
          <img src={msg.media_url} alt="" className="rounded-lg mb-1 max-h-64 w-auto" />
        ) : msg.content_type === "video" ? (
          <video src={msg.media_url} controls className="rounded-lg mb-1 max-h-64" />
        ) : msg.content_type === "audio" ? (
          <audio src={msg.media_url} controls className="mb-1 w-full" />
        ) : (
          <a href={msg.media_url} target="_blank" rel="noopener"
             className="text-xs underline underline-offset-2 break-all">
            📎 {msg.media_url.split("/").pop()}
          </a>
        ))}

        {/* Text */}
        {msg.content && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
        )}

        {/* Footer: time + status */}
        <div className={cn("flex items-center gap-1 mt-1 text-[10px] tabular-nums",
                            outbound ? "justify-end opacity-80" : "justify-start text-muted-foreground")}>
          <span>{time(msg.created_at)}</span>
          {outbound && <StatusIcon status={msg.status} />}
        </div>

        {msg.status === "failed" && msg.error_message && (
          <p className="text-[10px] text-destructive mt-1 italic">{msg.error_message}</p>
        )}
      </div>
    </div>
  );
}
