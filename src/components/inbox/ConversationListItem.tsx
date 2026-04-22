// src/components/inbox/ConversationListItem.tsx
import { cn } from "@/lib/utils";
import { ChannelBadge } from "./ChannelBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ConversationRow } from "@/hooks/useConversations";

type Props = {
  conv: ConversationRow;
  active: boolean;
  onClick: () => void;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return "now";
  if (m < 60)   return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)    return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string | null, fallback: string): string {
  const s = (name || fallback || "?").trim();
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join("") || "?";
}

export function ConversationListItem({ conv, active, onClick }: Props) {
  const name = conv.display_name || conv.external_id || "Unknown";
  const unread = conv.unread_count > 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full flex items-start gap-3 px-4 py-3 text-start border-b border-border/40 transition",
        "hover:bg-muted/50 focus:bg-muted/60 focus:outline-none",
        active && "bg-[color:var(--brand-accent,theme(colors.muted.DEFAULT))]",
      )}
    >
      {/* Avatar + channel dot */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-11 w-11">
          {conv.profile_pic_url && <AvatarImage src={conv.profile_pic_url} alt={name} />}
          <AvatarFallback className="text-xs font-semibold">{initials(conv.display_name, conv.external_id)}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-0.5 -end-0.5 ring-2 ring-background rounded-full">
          <ChannelBadge channel={conv.channel} size="xs" />
        </div>
      </div>

      {/* Text block */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className={cn("truncate text-sm", unread ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>
            {name}
          </p>
          <span className="ms-auto flex-shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {timeAgo(conv.last_message_at)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className={cn("flex-1 truncate text-xs",
                           unread ? "text-foreground/80" : "text-muted-foreground")}>
            {conv.last_message_direction === "outbound" && <span className="text-muted-foreground/60">You: </span>}
            {conv.last_message_preview || <span className="italic">No messages yet</span>}
          </p>
          {unread && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 grid place-items-center rounded-full
                             text-[10px] font-bold text-white"
                  style={{ backgroundColor: "var(--brand-primary, hsl(var(--primary)))" }}>
              {conv.unread_count > 99 ? "99+" : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
