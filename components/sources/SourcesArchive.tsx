"use client";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { FileGlyph } from "@/components/primitives";
import { formatSourceRow, filterSources, type SourceRowData } from "@/lib/db/map";

const GRID = "2.2fr 1.6fr 0.9fr 0.7fr 1.1fr 96px";

export default function SourcesArchive({ sources }: { sources: SourceRowData[] }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");

  const views = useMemo(() => sources.map((s) => formatSourceRow(s, lang)), [sources, lang]);
  const shown = useMemo(() => filterSources(views, q), [views, q]);

  return (
    <div style={{ maxWidth: 980 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("sources_search")}
        aria-label={t("sources_search")}
        style={{
          width: "100%", maxWidth: 360, padding: "9px 14px", marginBottom: 22,
          border: "1px solid var(--line)", borderRadius: 9, background: "var(--surface)",
          color: "inherit", fontSize: 13.5, outline: "none",
        }}
      />

      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 16, padding: "11px 20px",
          fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-3)",
          borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
          <div>{t("src_col_file")}</div>
          <div>{t("src_col_party")}</div>
          <div>{t("src_col_size")}</div>
          <div>{t("src_col_pages")}</div>
          <div>{t("src_col_date")}</div>
          <div />
        </div>

        {shown.length === 0 ? (
          <div className="muted" style={{ padding: "26px 20px", fontSize: 13.5 }}>{t("sources_none")}</div>
        ) : (
          shown.map((r, i) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: GRID, gap: 16,
              padding: "14px 20px", alignItems: "center",
              borderBottom: i === shown.length - 1 ? "none" : "1px solid var(--line)" }}>
              <div className="row gap-12" style={{ minWidth: 0 }}>
                <FileGlyph type={r.ext} size={30} />
                <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
              </div>
              <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.counterparty ?? <span className="dim">—</span>}
              </div>
              <div className="mono tnum" style={{ fontSize: 12.5 }}>{r.sizeText}</div>
              <div className="mono tnum" style={{ fontSize: 12.5 }}>{r.pages}</div>
              <div className="muted mono" style={{ fontSize: 11.5 }}>{r.dateText}</div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                {r.blobKey ? (
                  <a href={r.blobKey} download style={{ fontSize: 12.5, color: "var(--accent)", textDecoration: "none", whiteSpace: "nowrap" }}>
                    {t("src_download")}
                  </a>
                ) : (
                  <span className="dim" style={{ fontSize: 12.5 }}>—</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
