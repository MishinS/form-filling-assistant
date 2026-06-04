"use client";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Eyebrow, Btn, Card, Icon, Tag } from "@/components/primitives";
import { TEMPLATES } from "@/lib/seed/pt";

export default function TemplateGallery() {
  const router = useRouter();
  const { t, lang } = useI18n();
  return (
    <div className="fade-in" style={{ padding: "44px 48px 64px", maxWidth: 1180, margin: "0 auto" }}>
      <Eyebrow>{t("nav_templates")}</Eyebrow>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 38 }}>{t("tpl_h")}</h1>
          <p className="muted" style={{ fontSize: 15, marginTop: 14, maxWidth: 520 }}>{t("tpl_sub")}</p>
        </div>
        <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
          <Btn variant="primary" size="md" icon="plus" disabled>{t("new_template")}</Btn>
          <span className="mono dim" style={{ fontSize: 10.5 }}>{t("soon")}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 40 }}>
        {TEMPLATES.map(tpl => (
          <Card key={tpl.id} hover pad={20} onClick={() => router.push(`/templates/${tpl.id}`)} style={{ display: "flex", flexDirection: "column" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ width: 42, height: 42, borderRadius: 11, display: "grid", placeItems: "center",
                background: tpl.primary ? "var(--accent)" : "var(--surface-3)", color: tpl.primary ? "var(--accent-text)" : "var(--text-2)",
                border: tpl.primary ? "none" : "1px solid var(--line-2)" }}>
                <Icon name={tpl.primary ? "bolt" : "doc"} size={19} />
              </span>
              <div className="row gap-6">
                <Tag tone="mono" style={{ height: 22 }}>{tpl.format}</Tag>
                {tpl.primary && <Tag tone="solid" style={{ height: 22 }}>{lang === "ru" ? "Основной" : "Primary"}</Tag>}
              </div>
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{lang === "ru" ? tpl.name_ru : tpl.name_en}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.45, flex: 1 }}>{lang === "ru" ? tpl.desc_ru : tpl.desc_en}</div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <span className="mono dim" style={{ fontSize: 11 }}>{tpl.fields} {t("fields_n")}</span>
              <span className="mono dim" style={{ fontSize: 11 }}>{lang === "ru" ? "обн." : "upd."} {tpl.updated}</span>
            </div>
            {tpl.sheets.length > 0 && (
              <div className="row gap-6" style={{ marginTop: 10, flexWrap: "wrap" }}>
                {tpl.sheets.map(s => <Tag key={s} tone="line" style={{ height: 20, fontSize: 10.5 }}>{s}</Tag>)}
              </div>
            )}
          </Card>
        ))}

        {/* new template tile — creation out of scope for this slice */}
        <div style={{ borderRadius: "var(--r-lg)", border: "1.5px dashed var(--line-2)", background: "transparent",
          minHeight: 210, display: "grid", placeItems: "center", color: "var(--text-3)", opacity: .5, cursor: "default" }}>
          <div className="col gap-10" style={{ alignItems: "center" }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", border: "1px solid var(--line-2)" }}><Icon name="plus" size={20} /></span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t("new_template")}</span>
            <span className="mono dim" style={{ fontSize: 10.5 }}>{t("soon")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
