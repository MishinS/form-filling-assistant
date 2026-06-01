"use client";
import { useI18n } from "@/lib/i18n";
import { Icon, Tag } from "@/components/primitives";
import { TEMPLATES } from "@/lib/seed/pt";

type Props = { selected: string; onSelect: (id: string) => void };

export default function TemplatePick({ selected, onSelect }: Props) {
  const { t, lang } = useI18n();
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 12 }}>{t("choose_template")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {TEMPLATES.map(tpl => {
          const on = selected === tpl.id;
          return (
            <button key={tpl.id} onClick={() => onSelect(tpl.id)}
              style={{ textAlign: "left", padding: 17, borderRadius: "var(--r-md)",
                background: on ? "var(--surface-3)" : "var(--surface-1)",
                border: `1px solid ${on ? "var(--line-strong)" : "var(--line)"}`,
                display: "flex", gap: 13, alignItems: "flex-start",
                transition: "all .15s", position: "relative" }}>
              <span style={{ width: 38, height: 38, borderRadius: 9, flex: "none", display: "grid", placeItems: "center",
                background: on ? "var(--accent)" : "var(--surface-3)", color: on ? "var(--accent-text)" : "var(--text-2)",
                border: on ? "none" : "1px solid var(--line-2)", transition: "all .15s" }}>
                <Icon name={tpl.primary ? "bolt" : "doc"} size={17} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row gap-8" style={{ alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{lang === "ru" ? tpl.name_ru : tpl.name_en}</span>
                  <Tag tone="mono" style={{ height: 18, fontSize: 10 }}>{tpl.format}</Tag>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 5, lineHeight: 1.4 }}>{lang === "ru" ? tpl.desc_ru : tpl.desc_en}</div>
                <div className="mono dim" style={{ fontSize: 11, marginTop: 9 }}>{tpl.fields} {t("fields_n")} · {tpl.code}</div>
              </div>
              <span style={{ width: 17, height: 17, borderRadius: 99, flex: "none", border: `1.5px solid ${on ? "var(--accent)" : "var(--line-2)"}`,
                display: "grid", placeItems: "center", background: on ? "var(--accent)" : "transparent" }}>
                {on && <Icon name="check" size={11} stroke={2.4} style={{ color: "var(--accent-text)" }} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
