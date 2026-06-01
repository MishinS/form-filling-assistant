"use client";
import { useI18n } from "@/lib/i18n";
import { Icon, Tag, Btn } from "@/components/primitives";

type Props = { onClose: () => void; onDownload?: (fmt: "excel" | "pdf") => void };

export default function DoneStep({ onClose, onDownload }: Props) {
  const { t, lang } = useI18n();
  const download = (fmt: "excel" | "pdf") => onDownload?.(fmt);
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
          <div className="row gap-8"><Icon name="doc" size={15} className="muted" /><span style={{ fontSize: 13, fontWeight: 600 }}>ПТ_МК-Клевер_Ф15.xlsx</span></div>
          <Tag tone="line"><span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--ok)" }} />{t("st_done")}</Tag>
        </div>
        <div className="doc-stripes" style={{ height: 150, display: "grid", placeItems: "center" }}>
          <span className="mono dim" style={{ fontSize: 12 }}>{lang === "ru" ? "предпросмотр заполненного документа" : "filled document preview"}</span>
        </div>
      </div>

      <div className="row gap-12" style={{ justifyContent: "center", marginTop: 26 }}>
        <Btn variant="primary" size="lg" icon="download" onClick={() => download("excel")}>{t("dl_excel")}</Btn>
        <Btn variant="ghost" size="lg" icon="download" onClick={() => download("pdf")}>{t("dl_pdf")}</Btn>
      </div>
      <button onClick={onClose} className="muted" style={{ marginTop: 18, fontSize: 13, fontWeight: 600 }}>{t("open_dash")}</button>
    </div>
  );
}
