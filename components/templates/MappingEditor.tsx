"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Icon, Tag, Btn } from "@/components/primitives";
import { TEMPLATES, MAPPING } from "@/lib/seed/pt";
import MiniSheet from "./MiniSheet";

export default function MappingEditor({ templateId }: { templateId: string }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const tpl = TEMPLATES.find(x => x.id === templateId);
  const rows = templateId === "pt" ? MAPPING : MAPPING.slice(0, tpl?.fields ?? 0);
  const [sel, setSel] = useState(rows[0]?.id);

  if (!tpl) return null;

  return (
    <div className="fade-in" style={{ padding: "28px 36px 56px", maxWidth: 1280, margin: "0 auto" }}>
      <button onClick={() => router.push("/templates")} className="row gap-8 muted" style={{ fontSize: 13, fontWeight: 600, marginBottom: 22 }}>
        <Icon name="arrowL" size={15} />{t("nav_templates")}
      </button>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <div className="row gap-10">
            <h1 style={{ fontSize: 26 }}>{lang === "ru" ? tpl.name_ru : tpl.name_en}</h1>
            <Tag tone="mono" style={{ height: 24 }}>{tpl.format}</Tag>
            <Tag tone="mono" style={{ height: 24 }}>{tpl.code}</Tag>
          </div>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{t("mapping_h")}</p>
        </div>
        <div className="row gap-10">
          <Btn variant="ghost" size="md" icon="plus">{t("add_field")}</Btn>
          <Btn variant="primary" size="md" icon="check">{t("save")}</Btn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 18, alignItems: "start" }}>
        {/* mapping table */}
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 78px 50px 34px", gap: 12, padding: "11px 16px", borderBottom: "1px solid var(--line)", color: "var(--text-3)" }}>
            {[t("field"), t("rule"), t("cell"), t("required"), ""].map((c, i) => (
              <div key={i} className="mono" style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase" }}>{c}</div>
            ))}
          </div>
          {rows.map((r, i) => {
            const on = sel === r.id;
            const ruleTone = r.rule.startsWith("LLM") ? "var(--info)" : r.rule.startsWith("Ручной") ? "var(--text-3)" : "var(--ok)";
            return (
              <div key={r.id} onClick={() => setSel(r.id)}
                style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 78px 50px 34px", gap: 12, padding: "12px 16px", alignItems: "center",
                  cursor: "pointer", borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line)",
                  background: on ? "var(--surface-3)" : "transparent", transition: "background .12s" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lang === "ru" ? r.label_ru : r.label_en}</div>
                  <div className="mono dim" style={{ fontSize: 10 }}>{r.kind}</div>
                </div>
                <div className="row gap-6" style={{ minWidth: 0 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 99, background: ruleTone, flex: "none" }} />
                  <span className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.rule}</span>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-2)" }}>{r.cell.replace("ПТ!", "")}</span>
                <div>{r.required
                  ? <span style={{ width: 16, height: 16, borderRadius: 5, background: "var(--surface-hi)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center" }}><Icon name="check" size={10} stroke={2.4} /></span>
                  : <span style={{ width: 16, height: 16, borderRadius: 5, border: "1px solid var(--line-2)", display: "block" }} />}
                </div>
                <button className="dim" style={{ width: 26, height: 26, borderRadius: 6, display: "grid", placeItems: "center" }}
                  onClick={e => e.stopPropagation()}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hi)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}><Icon name="trash" size={13} /></button>
              </div>
            );
          })}
        </div>

        {/* document preview with highlighted cell */}
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)", position: "sticky", top: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
            <div className="row gap-8"><Icon name="eye" size={14} className="muted" /><span style={{ fontSize: 12.5, fontWeight: 600 }}>{t("preview")}</span></div>
            <Tag tone="mono" style={{ height: 22 }}>{rows.find(r => r.id === sel)?.cell || "—"}</Tag>
          </div>
          <MiniSheet rows={rows} sel={sel} />
        </div>
      </div>
    </div>
  );
}
