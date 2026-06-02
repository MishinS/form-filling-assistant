"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Logo, Icon, Btn } from "@/components/primitives";
import { TEMPLATES } from "@/lib/seed/pt";
import { uploadToBlob, formatSize, inferMime, type UploadFile } from "@/lib/upload/client";
import type { ParsedDoc } from "@/lib/parse/types";
import type { ExtractedValue } from "@/lib/types";
import Stepper from "./Stepper";
import TemplatePick from "./TemplatePick";
import Dropzone from "./Dropzone";
import Processing from "./Processing";
import DoneStep from "./DoneStep";
import ReviewStep from "@/components/review/ReviewStep";

let uid = 0;
const nextId = () => `up-${Date.now()}-${uid++}`;

export function WizardModal({ start, onClose }: { start: number; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState(start);
  const [tpl, setTpl] = useState("pt");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [docs, setDocs] = useState<ParsedDoc[]>([]);
  const [values, setValues] = useState<ExtractedValue[]>([]);
  const MODEL = "gemini-2.0-flash";

  const patch = (id: string, p: Partial<UploadFile>) =>
    setFiles(fs => fs.map(f => (f.fileId === id ? { ...f, ...p } : f)));

  const onPick = (picked: File[]) => {
    for (const file of picked) {
      const fileId = nextId();
      const entry: UploadFile = {
        fileId, name: file.name, mime: inferMime(file), size: formatSize(file.size),
        blobUrl: "", pages: 0, scanned: false, status: "uploading", progress: 0,
      };
      setFiles(fs => [...fs, entry]);
      uploadToBlob(file, pct => patch(fileId, { progress: Math.round(pct) }))
        .then(({ url }) => patch(fileId, { blobUrl: url, status: "ok", progress: 100 }))
        .catch((e: Error) => patch(fileId, { status: "error", error: e.message }));
    }
  };

  const removeFile = (id: string) => setFiles(fs => fs.filter(f => f.fileId !== id));
  const uploaded = files.filter(f => f.status === "ok");
  const canStart = !!tpl && uploaded.length > 0 && files.every(f => f.status !== "uploading");
  const curTpl = TEMPLATES.find(x => x.id === tpl);

  const startParse = () => {
    setStep(1);
  };

  const onExtracted = (vals: ExtractedValue[], parsed: ParsedDoc[]) => {
    setDocs(parsed);
    setValues(vals);
    setFiles(fs => fs.map(f => {
      const d = parsed.find(p => p.fileId === f.fileId);
      return d ? { ...f, pages: d.pages, scanned: d.scannedPages.length > 0 } : f;
    }));
    setStep(2);
  };

  return (
    <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(6,9,8,.72)", backdropFilter: "blur(8px)",
      display: "grid", placeItems: "center", padding: 28 }}>
      <div style={{ width: "min(1080px, 100%)", maxHeight: "92vh", background: "var(--bg)", border: "1px solid var(--line-2)",
        borderRadius: "var(--r-xl)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 40px 120px rgba(0,0,0,.6)" }}>
        {/* header */}
        <div className="row" style={{ justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--line)", gap: 24 }}>
          <div className="row gap-12" style={{ minWidth: 0 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface-3)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center" }}><Logo size={15} /></span>
            <div className="col" style={{ lineHeight: 1.15 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t("new_fill")}</span>
              <span className="mono dim" style={{ fontSize: 10.5 }}>{curTpl ? (lang === "ru" ? curTpl.name_ru : curTpl.name_en) : ""}</span>
            </div>
          </div>
          <Stepper step={step} />
          <button onClick={onClose} className="muted" style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", border: "1px solid var(--line-2)" }}><Icon name="x" size={15} /></button>
        </div>

        {/* body */}
        <div className="row" style={{ flex: 1, minHeight: 0, alignItems: "stretch" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
            {step === 0 && (
              <div className="col gap-24" style={{ maxWidth: 760, margin: "0 auto" }}>
                <TemplatePick selected={tpl} onSelect={setTpl} />
                <Dropzone files={files} onPick={onPick} onRemove={removeFile} />
              </div>
            )}
            {step === 1 && <Processing sources={uploaded} model={MODEL} templateId={tpl} onDone={onExtracted} onBack={() => setStep(0)} />}
            {step === 2 && <ReviewStep values={values} docs={docs} />}
            {step === 3 && <DoneStep onClose={onClose} />}
          </div>
        </div>

        {/* footer */}
        {step !== 1 && step !== 3 && (
          <div className="row" style={{ justifyContent: "space-between", padding: "16px 24px", borderTop: "1px solid var(--line)", background: "var(--surface-1)" }}>
            <Btn variant="quiet" size="md" icon="arrowL" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>{t("back")}</Btn>
            {step === 0 && <Btn variant="primary" size="md" iconRight="arrowR" disabled={!canStart} onClick={startParse}>{t("start_process")}</Btn>}
            {step === 2 && <Btn variant="primary" size="md" icon="check" onClick={() => setStep(3)}>{t("confirm_fill")}</Btn>}
          </div>
        )}
      </div>
    </div>
  );
}
