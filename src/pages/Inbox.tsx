// src/pages/Inbox.tsx
// ---------------------------------------------------------------
// Unified inbox — replaces Dashboard as the authenticated home screen.
// Responsive: mobile shows list OR thread; desktop shows both side by side.
// Active conversation is reflected in the URL via ?c= so links are shareable.
// ---------------------------------------------------------------
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Inbox as InboxIcon } from "lucide-react";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ThreadView } from "@/components/inbox/ThreadView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Inbox() {
  const { language } = useLanguage();
  const [params, setParams] = useSearchParams();
  const activeId = params.get("c");
  const [isMobile, setIsMobile] = useState(false);

  // Simple mobile detection. We use flexbox breakpoints for layout,
  // but need this bit for the list<->thread toggle on small screens.
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("c", id);
    setParams(next, { replace: true });
  };

  const back = () => {
    const next = new URLSearchParams(params);
    next.delete("c");
    setParams(next, { replace: true });
  };

  const tWelcome = language === "ar" ? "اختر محادثة لعرضها" : "Select a conversation to view";
  const tHint    = language === "ar"
    ? "جميع رسائل الواتساب والإنستغرام في مكان واحد."
    : "All your WhatsApp and Instagram messages in one place.";

  // Mobile: show one at a time
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-theme(spacing.14))] bg-background">
        {activeId ? (
          <ThreadView conversationId={activeId} onBack={back} />
        ) : (
          <ConversationList activeId={null} onSelect={select} />
        )}
      </div>
    );
  }

  // Desktop: split view
  return (
    <div className="h-[calc(100vh-theme(spacing.14))] grid grid-cols-[340px_1fr] bg-background">
      <ConversationList activeId={activeId} onSelect={select} />
      {activeId ? (
        <ThreadView conversationId={activeId} />
      ) : (
        <div className="flex flex-col items-center justify-center h-full bg-muted/20 border-s border-border/60">
          <div className="h-14 w-14 rounded-2xl grid place-items-center mb-4"
               style={{ backgroundColor: "var(--brand-accent, hsl(var(--muted)))" }}>
            <InboxIcon className="h-6 w-6" style={{ color: "var(--brand-primary, hsl(var(--primary)))" }} />
          </div>
          <p className="text-sm font-medium text-foreground">{tWelcome}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs text-center">{tHint}</p>
        </div>
      )}
    </div>
  );
}
