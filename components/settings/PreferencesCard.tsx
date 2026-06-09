"use client";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { Card } from "@/components/primitives";

function Segmented({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="row" style={{ gap: 2, padding: 3, borderRadius: "var(--pill)", border: "1px solid var(--line-2)", width: "fit-content" }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{ height: 30, padding: "0 16px", borderRadius: "var(--pill)", fontSize: 12.5, fontWeight: 600,
            background: on ? "var(--accent)" : "transparent", color: on ? "var(--accent-text)" : "var(--text-2)", transition: "all .15s" }}>{o.label}</button>
        );
      })}
    </div>
  );
}

export default function PreferencesCard() {
  const { t, lang, setLang } = useI18n();
  const { mode, setMode } = useTheme();
  const themeOptions = [
    { id: "system", label: t("theme_system") },
    { id: "light", label: t("theme_light") },
    { id: "dark", label: t("theme_dark") },
  ];
  const langOptions = (["ru", "en"] as Lang[]).map((l) => ({ id: l, label: l.toUpperCase() }));
  return (
    <Card pad={22}>
      <div className="col gap-16">
        <h2 style={{ fontSize: 15 }}>{t("set_prefs")}</h2>
        <div className="col gap-6">
          <span className="muted" style={{ fontSize: 12 }}>{t("set_theme")}</span>
          <Segmented options={themeOptions} value={mode} onChange={(v) => setMode(v as ThemeMode)} />
        </div>
        <div className="col gap-6">
          <span className="muted" style={{ fontSize: 12 }}>{t("set_lang")}</span>
          <Segmented options={langOptions} value={lang} onChange={(v) => setLang(v as Lang)} />
        </div>
      </div>
    </Card>
  );
}
