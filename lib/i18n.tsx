"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { STR } from "@/lib/seed/pt";

export type Lang = "ru" | "en";
export function translate(key: string, lang: Lang): string {
  const s = STR[key];
  return s ? s[lang] ?? s.ru : key;
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ru");
  const t = (key: string) => translate(key, lang);
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
