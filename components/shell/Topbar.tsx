"use client";
import { useI18n, type Lang } from "@/lib/i18n";
import GlobalSearch from "./GlobalSearch";
import ThemeToggle from "./ThemeToggle";

export default function Topbar() {
  const { lang, setLang } = useI18n();
  return (
    <div className="row" style={{ height: 64, flex: "none", borderBottom: "1px solid var(--line)", padding: "0 28px", gap: 18 }}>
      <GlobalSearch />
      <div className="grow" />
      <div className="row" style={{ borderRadius: "var(--pill)", border: "1px solid var(--line-2)", padding: 3, gap: 2 }}>
        {(["ru", "en"] as Lang[]).map(l => (
          <button key={l} onClick={() => setLang(l)} style={{ height: 28, padding: "0 12px", borderRadius: "var(--pill)",
            fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em",
            background: lang === l ? "var(--accent)" : "transparent", color: lang === l ? "var(--accent-text)" : "var(--text-2)", transition: "all .15s" }}>{l}</button>
        ))}
      </div>
      <ThemeToggle />
    </div>
  );
}
