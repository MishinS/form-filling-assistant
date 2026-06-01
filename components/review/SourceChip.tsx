"use client";
import { useI18n } from "@/lib/i18n";
import { Icon, FileGlyph } from "@/components/primitives";
import type { PtField } from "@/lib/seed/pt";

type Props = { f: PtField; hover: string | null; setHover: (id: string | null) => void };

export default function SourceChip({ f, hover, setHover }: Props) {
  const { lang } = useI18n();
  const found = f.src.file !== "—";
  const on = hover === f.id;
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <span onMouseEnter={() => setHover(f.id)} onMouseLeave={() => setHover(null)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 9px", borderRadius: "var(--pill)",
          fontSize: 11.5, fontWeight: 600, cursor: found ? "help" : "default",
          background: found ? "var(--surface-3)" : "transparent",
          border: `1px solid ${found ? "var(--line-2)" : "transparent"}`,
          color: found ? "var(--text-2)" : "var(--text-3)" }}>
        <Icon name={found ? "link" : "edit"} size={11} />
        <span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{found ? f.src.file : (lang === "ru" ? "вручную" : "manual")}</span>
      </span>
      {on && found && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 20, width: 230,
          background: "var(--surface-hi)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-md)",
          padding: "10px 12px", boxShadow: "0 16px 40px rgba(0,0,0,.5)" }} className="fade-in">
          <div className="row gap-8" style={{ marginBottom: 7 }}><FileGlyph type={f.src.file.split(".").pop()!} size={26} /><span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{f.src.file}</span></div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-2)" }}>{f.src.loc}</div>
          <div className="doc-stripes" style={{ height: 54, borderRadius: 6, marginTop: 8, border: "1px solid var(--line)", display: "grid", placeItems: "center" }}>
            <span className="mono dim" style={{ fontSize: 9.5 }}>{lang === "ru" ? "фрагмент источника" : "source snippet"}</span>
          </div>
        </span>
      )}
    </span>
  );
}
