"use client";
import { useContext } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Eyebrow, Icon, StatusDot, FileGlyph, Confidence } from "@/components/primitives";
import type { StatusKey } from "@/lib/seed/pt";
import { TemplatesContext } from "@/components/shell/AppShell";
import { buildDetailGroups, formatFillDate, type FillDetail } from "@/lib/db/map";

export default function FillDetail({ data }: { data: FillDetail }) {
  const { t, lang } = useI18n();
  const { nameOf } = useContext(TemplatesContext);
  const tplName = (() => { const n = nameOf(data.templateId); return n ? (lang === "ru" ? n.ru : n.en) : data.templateId; })();
  const groups = buildDetailGroups(data.values, lang);
  const confLabel = (c: string) => t(c === "high" ? "conf_high" : c === "med" ? "conf_med" : "conf_low");
  const safeLevel = (c: string): "high" | "med" | "low" => (c === "high" || c === "med" || c === "low" ? c : "low");

  return (
    <div className="fade-in" style={{ padding: "44px clamp(16px,4vw,48px) 64px", maxWidth: 1180, margin: "0 auto" }}>
      <Link href="/fills" className="row gap-8" style={{ color: "var(--text-3)", fontSize: 13, marginBottom: 18, width: "fit-content" }}>
        <Icon name="arrowL" size={15} /> {t("detail_back")}
      </Link>

      <Eyebrow>{tplName}</Eyebrow>
      <div className="row gap-12" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 30 }}>{tplName}</h1>
        <StatusDot status={data.status as StatusKey} />
        <span className="muted mono" style={{ fontSize: 12.5 }}>{formatFillDate(data.createdAt, lang)}</span>
      </div>

      {/* Sources */}
      <div style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>{t("detail_sources")}</h2>
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)" }}>
          {data.sources.map((s, i) => (
            <div key={s.id} className="row gap-12" style={{ padding: "12px 18px", alignItems: "center",
              borderBottom: i === data.sources.length - 1 ? "none" : "1px solid var(--line)" }}>
              <FileGlyph type={(s.name.split(".").pop() ?? "file")} size={30} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
                <div className="mono dim" style={{ fontSize: 11 }}>{s.size} · {s.pages} стр.</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>{t("detail_fields")}</h2>
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)" }}>
          {/* head */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,2fr) minmax(0,0.8fr)", gap: 16, padding: "12px 20px",
            borderBottom: "1px solid var(--line)", color: "var(--text-3)" }}>
            {["field", "value", "confidence"].map((c) => (
              <div key={c} className="mono" style={{ fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase",
                textAlign: c === "confidence" ? "right" : "left" }}>{t(c)}</div>
            ))}
          </div>
          {/* groups */}
          {groups.map((g) => (
            <div key={g.group}>
              <div className="mono" style={{ padding: "10px 20px 6px", fontSize: 10.5, letterSpacing: ".06em",
                textTransform: "uppercase", color: "var(--text-3)", background: "var(--surface-2)" }}>{g.groupLabel}</div>
              {g.rows.map((r) => (
                <div key={r.fieldId} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,2fr) minmax(0,0.8fr)", gap: 16,
                  padding: "12px 20px", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
                  <div className="muted" style={{ fontSize: 13 }}>{r.label}</div>
                  <div style={{ fontSize: 13.5 }}>{r.value ? r.value : <span className="dim">—</span>}</div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Confidence level={safeLevel(r.confidence)} label={confLabel(r.confidence)} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
