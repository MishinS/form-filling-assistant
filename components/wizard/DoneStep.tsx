"use client";
import { useState, useContext, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Icon, Tag, Btn } from "@/components/primitives";
import { GuestContext } from "@/components/shell/GuestContext";
import { isTauri, saveFile } from "@/lib/desktop/tauri";
import { useToast } from "@/components/shell/Toast";
import type { ExtractedValue } from "@/lib/types";
import type { ExtractField } from "@/lib/extract/fields";
import type { SourceInput } from "@/lib/db/map";
import { outputKindOf, workbookName } from "./done-core";

type Props = { onClose: () => void; templateId: string; values: ExtractedValue[]; fields: ExtractField[]; sources: SourceInput[] };

export default function DoneStep({ onClose, templateId, values, fields, sources }: Props) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { guest } = useContext(GuestContext);
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [clipboardRefused, setClipboardRefused] = useState(false);

  const kind = outputKindOf(templateId);
  const fileName = workbookName(values);

  /** Best-effort: record this completed fill once, then revalidate server components
   *  so the fills list shows it without a manual refresh. Guests are not persisted. */
  const recordFill = useCallback(() => {
    if (guest || saved) return;
    setSaved(true);
    void fetch("/api/fills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, values, sources }),
    }).then(() => router.refresh()).catch(() => {});
  }, [guest, saved, templateId, values, sources, router]);

  // HTML-шаблон: документ собирается сразу, чтобы предпросмотр был виден без
  // лишнего нажатия — файла здесь нет, копировать нечего до сборки.
  useEffect(() => {
    if (kind !== "html" || html !== null) return;
    let alive = true;
    setBusy(true);
    fetch("/api/fill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, values }),
    })
      .then(async (res) => {
        // 422 — сохранённая версия шаблона перестала проходить проверку: чинится
        // в редакторе шаблона, а не повтором.
        if (res.status === 422) throw new Error("tpl_invalid");
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as { html: string };
      })
      .then((d) => {
        if (!alive) return;
        setHtml(d.html);
        recordFill();
      })
      .catch((e: unknown) => {
        if (alive) setErr(t(e instanceof Error && e.message === "tpl_invalid" ? "done_html_tpl_invalid" : "done_html_err"));
      })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [kind, html, templateId, values, recordFill, t]);

  const copyHtml = async () => {
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      show(t("done_copied"));
      setClipboardRefused(false);
    } catch {
      setClipboardRefused(true);
    }
  };

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
      if (isTauri()) {
        const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
        const dir = localStorage.getItem("ffa.downloadDir") ?? "";
        const path = await saveFile({ dir, filename: fileName, bytes });
        show(`${t("dl_saved_to")} ${path}`);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        show(t("dl_saved"));
      }
      recordFill();
    } catch {
      setErr(t("dl_excel_err"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 620, margin: "0 auto", textAlign: "center", padding: "8px 0" }}>
      <div style={{ width: 68, height: 68, margin: "0 auto 22px", borderRadius: 18, display: "grid", placeItems: "center",
        background: "var(--ok-bg)", color: "var(--ok)", border: "1px solid var(--ok-border)" }}>
        <Icon name="check" size={32} stroke={2.2} />
      </div>
      <h2 style={{ fontSize: 28 }}>{t("done_h")}</h2>
      <p className="muted" style={{ fontSize: 15, marginTop: 12, maxWidth: 440, marginInline: "auto" }}>
        {kind === "html" ? t("done_sub_html") : t("done_sub")}
      </p>

      <div style={{ marginTop: 28, borderRadius: "var(--r-lg)", border: "1px solid var(--line)", overflow: "hidden", textAlign: "left" }}>
        <div className="row" style={{ justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
          <div className="row gap-8">
            <Icon name="doc" size={15} className="muted" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{kind === "html" ? t("done_preview") : fileName}</span>
          </div>
          <Tag tone="line"><span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--ok)" }} />{t("st_done")}</Tag>
        </div>
        {kind === "html" && html ? (
          // Песочница без разрешений: скрипты в предпросмотре не выполняются, а
          // стили документа не текут в приложение.
          <iframe
            title={t("done_preview")}
            sandbox=""
            srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:12px;font:14px/1.45 system-ui">${html}</body>`}
            style={{ width: "100%", height: 320, border: "none", background: "#fff" }}
          />
        ) : (
          <div className="doc-stripes" style={{ height: 150, display: "grid", placeItems: "center" }}>
            <span className="mono dim" style={{ fontSize: 12 }}>
              {lang === "ru" ? "предпросмотр заполненного документа" : "filled document preview"}
            </span>
          </div>
        )}
      </div>

      {clipboardRefused && html && (
        <div className="col gap-8" style={{ marginTop: 16, textAlign: "left" }}>
          <span style={{ fontSize: 13, color: "var(--warn)" }}>{t("done_copy_err")}</span>
          <textarea
            readOnly
            value={html}
            onFocus={(e) => e.currentTarget.select()}
            rows={6}
            aria-label={t("done_copy")}
            className="mono"
            style={{ width: "100%", fontSize: 11.5, padding: "10px 12px", borderRadius: "var(--r-md)",
              background: "var(--surface-1)", border: "1px solid var(--line)" }}
          />
        </div>
      )}

      {err && (
        <p role="alert" style={{ marginTop: 16, color: "var(--bad)", fontSize: 13 }}>{err}</p>
      )}

      <div className="row gap-12" style={{ justifyContent: "center", marginTop: 26 }}>
        {kind === "html" ? (
          <Btn variant="primary" size="lg" icon="doc" onClick={copyHtml} disabled={busy || !html}>
            {busy ? t("dl_progress") : t("done_copy")}
          </Btn>
        ) : (
          <>
            <Btn variant="primary" size="lg" icon="download" onClick={downloadExcel} disabled={busy}>
              {busy ? t("dl_progress") : t("dl_excel")}
            </Btn>
            <div className="col" style={{ alignItems: "center", gap: 4 }}>
              <Btn variant="ghost" size="lg" icon="download" disabled>{t("dl_pdf")}</Btn>
              <span className="mono dim" style={{ fontSize: 10.5 }}>{t("pdf_soon")}</span>
            </div>
          </>
        )}
      </div>
      <button onClick={onClose} className="muted" style={{ marginTop: 18, fontSize: 13, fontWeight: 600 }}>{guest ? t("guest_again") : t("open_dash")}</button>
    </div>
  );
}
