"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon, FileGlyph } from "@/components/primitives";
import type { UiSourceFile } from "@/lib/seed/pt";

type Props = { files: UiSourceFile[]; onAdd: () => void; onRemove: (id: string) => void };

export default function Dropzone({ files, onAdd, onRemove }: Props) {
  const { t } = useI18n();
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); onAdd(); }}
        onClick={onAdd}
        style={{ borderRadius: "var(--r-lg)", cursor: "pointer", textAlign: "center",
          padding: "44px 24px",
          border: `1.5px dashed ${drag ? "var(--line-strong)" : "var(--line-2)"}`,
          background: drag ? "var(--surface-3)" : "var(--surface-1)",
          transition: "all .15s", position: "relative", overflow: "hidden" }}>
        <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 14, display: "grid", placeItems: "center",
          background: "var(--surface-3)", border: "1px solid var(--line-2)",
          transform: drag ? "translateY(-3px)" : "none", transition: "transform .2s var(--ease)" }}>
          <Icon name="upload" size={24} stroke={1.5} />
        </div>
        <div style={{ justifyContent: "center", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{t("drop_title")}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{t("drop_sub")}</div>
          </div>
        </div>
        <div className="mono dim" style={{ fontSize: 11, marginTop: 14 }}>{t("drop_hint")}</div>
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>
            {t("files_added")} · {files.length}
          </div>
          <div className="col gap-8">
            {files.map(f => (
              <div key={f.id} className="row gap-12 fade-in" style={{ padding: "11px 13px", borderRadius: "var(--r-md)",
                background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <FileGlyph type={f.type} size={34} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                  <div className="mono dim" style={{ fontSize: 11 }}>{f.size} · {f.pages} {f.pages === 1 ? "стр." : "стр."}</div>
                </div>
                <div className="row gap-6" style={{ color: "var(--ok)" }}>
                  <Icon name="checkc" size={15} /><span style={{ fontSize: 11.5, fontWeight: 600 }}>OK</span>
                </div>
                <button onClick={e => { e.stopPropagation(); onRemove(f.id); }} className="muted"
                  style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hi)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
