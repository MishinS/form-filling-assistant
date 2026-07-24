"use client";
import { useContext, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { ModelContext, TemplateMappingContext, TemplatesContext } from "@/components/shell/AppShell";
import { Logo, Icon, Btn } from "@/components/primitives";
import { inferMime, formatSize, type UploadFile } from "@/lib/upload/client";
import type { ExtractField } from "@/lib/extract/fields";
import TemplatePick from "@/components/wizard/TemplatePick";
import Dropzone from "@/components/wizard/Dropzone";
import { runBatch, type BatchItem } from "@/lib/batch/run-batch";
import { makeRunOne } from "@/lib/batch/run-one";
import { zipOutputs } from "@/lib/batch/zip";
import { isTauri, saveFile } from "@/lib/desktop/tauri";

let uid = 0;
const nextId = () => `bup-${Date.now()}-${uid++}`;

export function BatchModal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const { model } = useContext(ModelContext);
  const { fields: ptFields } = useContext(TemplateMappingContext);
  const { templates } = useContext(TemplatesContext);

  const [tpl, setTpl] = useState("pt");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [rawFiles, setRawFiles] = useState<Record<string, File>>({});
  const [customFields, setCustomFields] = useState<Record<string, ExtractField[]>>({});
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [doneItems, setDoneItems] = useState<BatchItem[] | null>(null);
  const [saved, setSaved] = useState(false);

  const fields = tpl === "pt" ? ptFields : customFields[tpl] ?? [];

  const selectTpl = (id: string) => {
    setTpl(id);
    if (id !== "pt" && customFields[id] === undefined) {
      setFieldsLoading(true);
      fetch(`/api/mappings?templateId=${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((d: { fields?: ExtractField[] | null }) =>
          setCustomFields((c) => ({ ...c, [id]: Array.isArray(d.fields) ? d.fields : [] })))
        .catch(() => setCustomFields((c) => ({ ...c, [id]: [] })))
        .finally(() => setFieldsLoading(false));
    }
  };

  const onPick = (picked: File[]) => {
    for (const file of picked) {
      const fileId = nextId();
      setRawFiles((m) => ({ ...m, [fileId]: file }));
      setFiles((fs) => [...fs, {
        fileId, name: file.name, mime: inferMime(file), size: formatSize(file.size),
        blobUrl: "", pages: 0, scanned: false, status: "ok", progress: 100,
      }]);
    }
  };
  const removeFile = (id: string) =>
    setFiles((fs) => fs.filter((f) => f.fileId !== id));

  const canRun = files.length > 0 && !fieldsLoading && fields.length > 0 && !running;

  const run = async () => {
    setRunning(true);
    setDoneItems(null);
    setSaved(false);
    const runOne = makeRunOne({ templateId: tpl, fields, model });
    const picked = files.map((f) => rawFiles[f.fileId]).filter(Boolean);
    const result = await runBatch(picked, runOne, setItems);
    setDoneItems(result);
    setRunning(false);
  };

  const download = async () => {
    const ok = (doneItems ?? []).filter((i) => i.status === "done" && i.bytes);
    if (ok.length === 0) return;
    const zip = zipOutputs(ok.map((i) => ({ name: i.name, bytes: i.bytes! })));
    const fname = "batch.zip";
    if (isTauri()) {
      const dir = localStorage.getItem("ffa.downloadDir") ?? "";
      await saveFile({ dir, filename: fname, bytes: Array.from(zip) });
    } else {
      const url = URL.createObjectURL(new Blob([new Uint8Array(zip)], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }
    setSaved(true);
  };

  // Protect batch results from accidental loss: never dismiss a running batch,
  // and confirm before discarding finished-but-unsaved results.
  const requestClose = () => {
    if (running) return;
    const hasUnsaved = !saved && (doneItems ?? []).some((i) => i.status === "done" && i.bytes);
    if (hasUnsaved && !window.confirm(t("batch_discard_confirm"))) return;
    onClose();
  };

  const progress = items.length ? items : files.map((f) => ({ fileId: f.fileId, name: f.name, status: "pending" as const }));
  const okCount = (doneItems ?? []).filter((i) => i.status === "done").length;
  const curTpl = templates.find((x) => x.id === tpl);

  const card = (
    <div className="col" style={{ width: "min(900px, 94vw)", height: "min(88vh, 760px)", background: "var(--surface-1)", borderRadius: "var(--r-xl)", border: "1px solid var(--line-2)", overflow: "hidden" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
        <div className="row gap-12" style={{ alignItems: "center" }}>
          <Logo size={20} />
          <span style={{ fontWeight: 600 }}>{t("batch_title")}</span>
          <span className="mono dim" style={{ fontSize: 10.5 }}>{curTpl ? (lang === "ru" ? curTpl.name_ru : curTpl.name_en) : ""}</span>
        </div>
        <button onClick={requestClose} className="muted" style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", border: "1px solid var(--line-2)" }}><Icon name="x" size={15} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        {!running && !doneItems && (
          <div className="col gap-24" style={{ maxWidth: 760, margin: "0 auto" }}>
            <TemplatePick selected={tpl} onSelect={selectTpl} />
            <Dropzone files={files} onPick={onPick} onRemove={removeFile} />
          </div>
        )}
        {(running || doneItems) && (
          <div className="col gap-8" style={{ maxWidth: 620, margin: "0 auto" }}>
            {progress.map((it) => (
              <div key={it.fileId} className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--surface-2)" }}>
                <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                <span className="mono" style={{ fontSize: 11.5, color: it.status === "error" ? "var(--bad)" : it.status === "done" ? "var(--ok)" : "var(--text-2)" }}>
                  {it.status === "error" ? (it.error ?? t("batch_failed")) : t(`batch_${it.status}`)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderTop: "1px solid var(--line)", background: "var(--surface-1)" }}>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {doneItems ? `${t("batch_summary")}: ${okCount}/${doneItems.length}` : running ? t("batch_running") : `${files.length} ${t("files_added")}`}
        </span>
        {doneItems
          ? <Btn variant="primary" size="md" icon="download" disabled={okCount === 0} onClick={download}>{t("batch_download_all")}</Btn>
          : <Btn variant="primary" size="md" iconRight="arrowR" disabled={!canRun} onClick={run}>{t("batch_run")}</Btn>}
      </div>
    </div>
  );

  return (
    <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(6,9,8,.72)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center", padding: 20 }} onClick={requestClose}>
      <div onClick={(e) => e.stopPropagation()}>{card}</div>
    </div>
  );
}
