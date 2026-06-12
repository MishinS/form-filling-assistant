"use client";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/primitives";
import SettingsCog from "./SettingsCog";

export default function EmptyState({ kind }: { kind: "sources" | "settings" }) {
  const { lang } = useI18n();
  const map = {
    sources: { icon: "file", h: lang === "ru" ? "Источники" : "Sources", s: lang === "ru" ? "Архив загруженных счетов, договоров и КП." : "Archive of uploaded invoices, contracts and quotes." },
    settings: { icon: "", h: lang === "ru" ? "Настройки" : "Settings", s: lang === "ru" ? "Профиль, команда, интеграции и модель извлечения." : "Profile, team, integrations and extraction model." },
  }[kind];
  return (
    <div className="col" style={{ alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)", gap: 16 }}>
      <span style={{ width: 56, height: 56, borderRadius: 14, display: "grid", placeItems: "center", border: "1px solid var(--line-2)", background: "var(--surface-1)" }}>{kind === "settings" ? <SettingsCog size={24} spin="hover" /> : <Icon name={map.icon} size={24} />}</span>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 20, color: "var(--text)" }}>{map.h}</h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>{map.s}</p>
      </div>
    </div>
  );
}
