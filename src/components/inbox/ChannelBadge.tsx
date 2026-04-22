// src/components/inbox/ChannelBadge.tsx
import { MessageCircle, Instagram, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  channel: "whatsapp" | "instagram" | "telegram" | "linkedin";
  size?: "xs" | "sm";
  withLabel?: boolean;
  className?: string;
};

const CONFIG = {
  whatsapp: { Icon: MessageCircle, bg: "bg-[#25D366]/10", fg: "text-[#128C7E]", ring: "ring-[#25D366]/20", label: "WhatsApp" },
  instagram:{ Icon: Instagram,     bg: "bg-pink-500/10",   fg: "text-pink-600",  ring: "ring-pink-500/20",  label: "Instagram" },
  telegram: { Icon: Send,          bg: "bg-sky-500/10",    fg: "text-sky-600",   ring: "ring-sky-500/20",   label: "Telegram" },
  linkedin: { Icon: Send,          bg: "bg-blue-500/10",   fg: "text-blue-600",  ring: "ring-blue-500/20",  label: "LinkedIn" },
} as const;

export function ChannelBadge({ channel, size = "sm", withLabel = false, className }: Props) {
  const c = CONFIG[channel];
  const dot = size === "xs" ? "h-4 w-4" : "h-5 w-5";
  const iconSize = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";
  if (!withLabel) {
    return (
      <span className={cn("inline-flex items-center justify-center rounded-full ring-1", dot, c.bg, c.fg, c.ring, className)}
            aria-label={c.label} title={c.label}>
        <c.Icon className={iconSize} />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                        c.bg, c.fg, c.ring, className)}>
      <c.Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}
