// lib/theme.tsx
"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type ThemeMode, type ResolvedTheme, THEME_COOKIE, resolveTheme } from "./theme-core";

// Re-export the public types so consumers import everything theme-related from "@/lib/theme".
export type { ThemeMode, ResolvedTheme } from "./theme-core";

type Ctx = { mode: ThemeMode; resolved: ResolvedTheme; setMode: (m: ThemeMode) => void };
const ThemeContext = createContext<Ctx | null>(null);
const MQ = "(prefers-color-scheme: dark)";

export function ThemeProvider({ children, initialMode }: { children: ReactNode; initialMode: ThemeMode }) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [prefersDark, setPrefersDark] = useState(false);

  // Track the device preference (only consulted when mode === "system").
  useEffect(() => {
    const m = window.matchMedia(MQ);
    setPrefersDark(m.matches);
    const on = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  const resolved = resolveTheme(mode, prefersDark);

  // Keep <html data-theme> in sync (the pre-paint script sets the very first value).
  useEffect(() => { document.documentElement.dataset.theme = resolved; }, [resolved]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    document.cookie = `${THEME_COOKIE}=${m};path=/;max-age=31536000;samesite=lax`;
  };

  return <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
