// src/components/inbox/ConversationList.tsx
import { useState } from "react";
import { Search, MessageSquareOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversations } from "@/hooks/useConversations";
import { ConversationListItem } from "./ConversationListItem";
import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  activeId: string | null;
  onSelect: (id: string) => void;
};

export function ConversationList({ activeId, onSelect }: Props) {
  const { language } = useLanguage();
  const [channel, setChannel] = useState<"all" | "whatsapp" | "instagram">("all");
  const [search,  setSearch]  = useState("");
  const { data: conversations = [], isLoading } = useConversations({ channel, status: "open", search });

  const t = {
    search: language === "ar" ? "ابحث عن محادثة..." : "Search conversations…",
    all:    language === "ar" ? "الكل" : "All",
    empty:  language === "ar" ? "لا توجد محادثات بعد" : "No conversations yet",
    emptyHint: language === "ar"
      ? "بمجرد أن يرسل عميل رسالة إلى رقم الواتساب الخاص بك، ستظهر هنا."
      : "Once a customer messages your WhatsApp number, it'll show up here.",
  };

  return (
    <div className="flex flex-col h-full bg-background border-e border-border/60">
      {/* Search */}
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="ps-9 h-9 text-sm bg-muted/40 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Channel filter */}
      <div className="px-3 pb-2">
        <Tabs value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
          <TabsList className="h-8 w-full grid grid-cols-3 bg-muted/40">
            <TabsTrigger value="all"       className="text-xs h-6">{t.all}</TabsTrigger>
            <TabsTrigger value="whatsapp"  className="text-xs h-6">WhatsApp</TabsTrigger>
            <TabsTrigger value="instagram" className="text-xs h-6">Instagram</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-11 w-11 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[240px] p-6 text-center">
            <MessageSquareOff className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t.empty}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">{t.emptyHint}</p>
          </div>
        )}
        {!isLoading && conversations.map((c) => (
          <ConversationListItem
            key={c.id}
            conv={c}
            active={activeId === c.id}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </ScrollArea>
    </div>
  );
}
