"use client";
import { useI18n, type Lang } from "@/lib/i18n";
import { Icon } from "@/components/primitives";

export default function Topbar() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="row" style={{ height: 64, flex: "none", borderBottom: "1px solid var(--line)", padding: "0 28px", gap: 18 }}>
      <div className="row gap-10 grow" style={{ maxWidth: 460 }}>
        <Icon name="search" size={16} className="dim" />
        <input placeholder={t("search")} style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13.5 }} />
      </div>
      <div className="grow" />
      <div className="row" style={{ borderRadius: "var(--pill)", border: "1px solid var(--line-2)", padding: 3, gap: 2 }}>
        {(["ru", "en"] as Lang[]).map(l => (
          <button key={l} onClick={() => setLang(l)} style={{ height: 28, padding: "0 12px", borderRadius: "var(--pill)",
            fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em",
            background: lang === l ? "var(--accent)" : "transparent", color: lang === l ? "var(--accent-text)" : "var(--text-2)", transition: "all .15s" }}>{l}</button>
        ))}
      </div>
      <button className="muted" style={{ width: 38, height: 38, borderRadius: 99, display: "grid", placeItems: "center", border: "1px solid var(--line-2)" }}><Icon name="gear" size={16} /></button>
    </div>
  );
}
