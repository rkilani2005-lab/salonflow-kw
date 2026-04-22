// src/contexts/TenantThemeContext.tsx
// ---------------------------------------------------------------
// Co-brand engine. Reads public.tenant_theme for the current tenant
// and writes CSS custom properties onto :root so Tailwind / shadcn
// tokens flip to the tenant brand without per-component rewrites.
// Falls back to ZAINA defaults when no row exists.
// ---------------------------------------------------------------
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type TenantTheme = {
  brand_name: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  primary_foreground: string;
  accent_color: string;
  bg_color: string;
  text_color: string;
  muted_color: string;
  border_color: string;
  font_heading: string;
  font_body: string;
  font_arabic: string;
  show_powered_by: boolean;
  powered_by_text: string;
  powered_by_url: string;
  whatsapp_link: string | null;
  instagram_handle: string | null;
};

const ZAINA_DEFAULT: TenantTheme = {
  brand_name: "ZAINA",
  logo_url: null,
  logo_dark_url: null,
  favicon_url: null,
  primary_color: "#C0395E",
  primary_foreground: "#FFFFFF",
  accent_color: "#FAF5F1",
  bg_color: "#FFFFFF",
  text_color: "#0F1115",
  muted_color: "#6B7280",
  border_color: "#E5E7EB",
  font_heading: "Syne",
  font_body: "Inter",
  font_arabic: "Tajawal",
  show_powered_by: false,
  powered_by_text: "",
  powered_by_url: "",
  whatsapp_link: null,
  instagram_handle: null,
};

type Ctx = { theme: TenantTheme; loading: boolean; refresh: () => void };
const TenantThemeCtx = createContext<Ctx>({ theme: ZAINA_DEFAULT, loading: true, refresh: () => {} });

export const useTenantTheme = () => useContext(TenantThemeCtx);

export function TenantThemeProvider({ children }: { children: ReactNode }) {
  const { tenant_id } = useAuth();
  const [theme, setTheme] = useState<TenantTheme>(ZAINA_DEFAULT);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!tenant_id) { setTheme(ZAINA_DEFAULT); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("tenant_theme")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    setTheme(data ? { ...ZAINA_DEFAULT, ...data } : ZAINA_DEFAULT);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, [tenant_id]);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--brand-primary",    theme.primary_color);
    r.style.setProperty("--brand-primary-fg", theme.primary_foreground);
    r.style.setProperty("--brand-accent",     theme.accent_color);
    r.style.setProperty("--brand-bg",         theme.bg_color);
    r.style.setProperty("--brand-text",       theme.text_color);
    r.style.setProperty("--brand-muted",      theme.muted_color);
    r.style.setProperty("--brand-border",     theme.border_color);
    r.style.setProperty("--font-heading",     `"${theme.font_heading}", serif`);
    r.style.setProperty("--font-body",        `"${theme.font_body}", system-ui, sans-serif`);

    if (theme.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.href = theme.favicon_url;
    }
  }, [theme]);

  return (
    <TenantThemeCtx.Provider value={{ theme, loading, refresh: load }}>
      {children}
    </TenantThemeCtx.Provider>
  );
}

// Low-profile "Powered by ZAINA" stripe for co-branded tenants
export function PoweredByFooter() {
  const { theme } = useTenantTheme();
  if (!theme.show_powered_by || !theme.powered_by_text) return null;
  return (
    <a
      href={theme.powered_by_url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-2 end-3 z-40 text-[10px] text-muted-foreground/60
                 hover:text-muted-foreground transition px-2 py-1 rounded
                 bg-background/70 backdrop-blur-sm"
    >
      {theme.powered_by_text} ↗
    </a>
  );
}
