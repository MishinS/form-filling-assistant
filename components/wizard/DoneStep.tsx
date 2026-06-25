"use client";
import { useState, useContext } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon, Tag, Btn } from "@/components/primitives";
import { GuestContext } from "@/components/shell/GuestContext";
import type { ExtractedValue } from "@/lib/types";
import type { ExtractField } from "@/lib/extract/fields";
import type { SourceInput } from "@/lib/db/map";

type Props = { onClose: () => void; templateId: string; values: ExtractedValue[]; fields: ExtractField[]; sources: SourceInput[] };

export default function DoneStep({ onClose, templateId, values, fields, sources }: Props) {
  const { t, lang } = useI18n();
  const { guest } = useContext(GuestContext);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const counter = values.find(v => v.fieldId === "f1")?.value?.trim();
  const fileName = `ПТ_${counter ? counter.replace(/[\/\\:*?"<>|]+/g, "") + "_" : ""}Ф15.xlsx`;

  const downloadExcel = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, values, fields }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // Best-effort: record this completed fill once. Never blocks or fails the download. Guests are not persisted.
      if (!guest && !saved) {
        setSaved(true);
        void fetch("/api/fills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, values, sources }),
        }).catch(() => {});
      }
    } catch {
      setErr(t("dl_excel_err"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 620, margin: "0 auto", textAlign: "center", padding: "8px 0" }}>
      <div style={{ width: 68, height: 68, margin: "0 auto 22px", borderRadius: 18, display: "grid", placeItems: "center",
        background: "var(--ok-bg)", color: "var(--ok)", border: "1px solid rgba(127,179,140,.3)" }}>
        <Icon name="check" size={32} stroke={2.2} />
      </div>
      <h2 style={{ fontSize: 28 }}>{t("done_h")}</h2>
      <p className="muted" style={{ fontSize: 15, marginTop: 12, maxWidth: 440, marginInline: "auto" }}>{t("done_sub")}</p>

      {/* preview placeholder */}
      <div style={{ marginTop: 28, borderRadius: "var(--r-lg)", border: "1px solid var(--line)", overflow: "hidden", textAlign: "left" }}>
        <div className="row" style={{ justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
          <div className="row gap-8"><Icon name="doc" size={15} className="muted" /><span style={{ fontSize: 13, fontWeight: 600 }}>{fileName}</span></div>
          <Tag tone="line"><span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--ok)" }} />{t("st_done")}</Tag>
        </div>
        <div className="doc-stripes" style={{ height: 150, display: "grid", placeItems: "center" }}>
          <span className="mono dim" style={{ fontSize: 12 }}>{lang === "ru" ? "предпросмотр заполненного документа" : "filled document preview"}</span>
        </div>
      </div>

      {err && (
        <p role="alert" style={{ marginTop: 16, color: "var(--bad)", fontSize: 13 }}>{err}</p>
      )}

      <div className="row gap-12" style={{ justifyContent: "center", marginTop: 26 }}>
        <Btn variant="primary" size="lg" icon="download" onClick={downloadExcel} disabled={busy}>
          {busy ? t("dl_progress") : t("dl_excel")}
        </Btn>
        <div className="col" style={{ alignItems: "center", gap: 4 }}>
          <Btn variant="ghost" size="lg" icon="download" disabled>{t("dl_pdf")}</Btn>
          <span className="mono dim" style={{ fontSize: 10.5 }}>{t("pdf_soon")}</span>
        </div>
      </div>
      <button onClick={onClose} className="muted" style={{ marginTop: 18, fontSize: 13, fontWeight: 600 }}>{guest ? t("guest_again") : t("open_dash")}</button>
    </div>
  );
}
