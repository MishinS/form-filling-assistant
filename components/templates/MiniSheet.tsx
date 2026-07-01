"use client";
import { useI18n } from "@/lib/i18n";
import type { ExtractField } from "@/lib/extract/fields";

type Props = { fields: ExtractField[]; sel: string; title?: string };

export default function MiniSheet({ fields, sel, title }: Props) {
  const { lang } = useI18n();
  const lines = [
    { head: true as const, label: title ?? (lang === "ru" ? "ПЛАТЁЖНОЕ ТРЕБОВАНИЕ" : "PAYMENT REQUEST"), id: "__head", cell: "" },
    ...fields.map(f => ({ head: false as const, id: f.id, label: lang === "ru" ? f.label_ru : f.label_en, cell: f.cell.replace("ПТ!", "") })),
  ];
  return (
    <div style={{ padding: 16 }}>
      <div style={{ border: "1px solid var(--line-2)", borderRadius: 8, overflow: "hidden", background: "var(--bg)" }}>
        {lines.map((l, i) => l.head ? (
          <div key="h" style={{ padding: "12px 14px", textAlign: "center", borderBottom: "1px solid var(--line-2)", background: "var(--surface-2)" }}>
            <span className="display" style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".02em" }}>{l.label}</span>
          </div>
        ) : (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)", borderBottom: i === lines.length - 1 ? "none" : "1px solid var(--line)",
            background: l.id === sel ? "var(--warn-bg)" : "transparent", transition: "background .2s" }}>
            <div style={{ padding: "9px 12px", fontSize: 10.5, color: "var(--text-2)", borderRight: "1px solid var(--line)", lineHeight: 1.3 }}>{l.label}:</div>
            <div className="row" style={{ padding: "9px 12px", justifyContent: "space-between", gap: 8 }}>
              <span style={{ height: 7, flex: 1, borderRadius: 99, background: l.id === sel ? "rgba(215,177,105,.5)" : "var(--line-2)" }} />
              <span className="mono" style={{ fontSize: 9, color: l.id === sel ? "var(--warn)" : "var(--text-3)" }}>{l.cell}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="row gap-8 dim" style={{ justifyContent: "center", marginTop: 12, fontSize: 10.5 }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--warn-bg)", border: "1px solid rgba(215,177,105,.4)" }} />
        <span className="mono">{lang === "ru" ? "выбранная ячейка" : "selected cell"}</span>
      </div>
    </div>
  );
}
