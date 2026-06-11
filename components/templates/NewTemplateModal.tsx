"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { useI18n } from "@/lib/i18n";
import { Btn, Icon } from "@/components/primitives";
import { MIME } from "@/lib/parse/types";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const fieldStyle = { background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", padding: "10px 12px", fontSize: 14, outline: "none", width: "100%" } as const;

type Phase = "form" | "busy" | "failed";
type FailCode = "llm" | "nofields" | "file" | "xlsx" | "server";

type StreamEvent =
  | { type: "stage"; stage: "sheets" | "save" }
  | { type: "attempt"; model: string; index?: number; total?: number }
  | { type: "attempt-fail"; model: string; reason?: string }
  | { type: "result"; id: string; fields: number }
  | { type: "error"; code: FailCode };

const FAIL_KEY: Record<FailCode, string> = {
  llm: "tpl_scan_fail_llm",
  nofields: "tpl_scan_fail_nofields",
  file: "tpl_scan_fail_file",
  xlsx: "tpl_scan_fail_file",
  server: "tpl_scan_fail_server",
};

export default function NewTemplateModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState("");
  const [fail, setFail] = useState<FailCode | null>(null);
  const [err, setErr] = useState<string | null>(null); // file-pick validation
  const blobUrlRef = useRef<string | null>(null); // survives a failed scan → retry skips re-upload
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = phase === "busy";

  const pick = (f: File | undefined) => {
    setErr(null);
    if (!f) return;
    if ((f.type && f.type !== MIME.xlsx) || !f.name.toLowerCase().endsWith(".xlsx") || f.size > MAX_BYTES) {
      setErr(t("tpl_new_err_file"));
      return;
    }
    setFile(f);
    blobUrlRef.current = null; // a new file invalidates the previously uploaded blob
  };

  const failWith = (code: FailCode) => { setFail(code); setPhase("failed"); };

  const modelStage = (i: number, n: number) =>
    t("tpl_scan_model").replace("{i}", String(i)).replace("{n}", String(n));

  const create = async () => {
    if (!file || !name.trim()) return;
    setPhase("busy"); setFail(null); setErr(null);
    try {
      let url = blobUrlRef.current;
      if (!url) {
        setStage(t("tpl_scan_upload")); setPct(0);
        const r = await upload(file.name, file, {
          access: "public", handleUploadUrl: "/api/blob/template", contentType: MIME.xlsx,
          onUploadProgress: ({ percentage }) => setPct(Math.round(percentage * 0.25)),
        });
        url = r.url; blobUrlRef.current = url;
      }
      setStage(t("tpl_scan_sheets")); setPct(25);
      const res = await fetch("/api/templates", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), desc: desc.trim(), url }),
      });
      if (!res.ok || !res.body) { failWith("server"); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const box: { result: { id: string } | null; error: FailCode | null } = { result: null, error: null };
      const handleLine = (line: string) => {
        if (!line) return;
        const ev = JSON.parse(line) as StreamEvent;
        if (ev.type === "stage" && ev.stage === "sheets") { setStage(t("tpl_scan_sheets")); setPct(25); }
        else if (ev.type === "attempt") {
          const i = ev.index ?? 1; const n = ev.total ?? 1;
          setStage(modelStage(i, n)); setPct(30 + Math.round(((i - 1) / n) * 60));
        } else if (ev.type === "stage" && ev.stage === "save") { setStage(t("tpl_scan_save")); setPct(95); }
        else if (ev.type === "result") { box.result = ev; }
        else if (ev.type === "error") { box.error = ev.code; }
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          handleLine(buf.slice(0, nl).trim());
          buf = buf.slice(nl + 1);
        }
      }
      buf += decoder.decode(); // flush decoder state
      handleLine(buf.trim());

      if (box.error) { failWith(box.error); return; }
      if (!box.result) { failWith("server"); return; }
      setPct(100);
      router.push(`/templates/${box.result.id}`);
      router.refresh();
    } catch {
      failWith("server");
    }
  };

  const modal = (
    <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(6,9,8,.72)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center", padding: 28 }}
      onClick={busy ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(480px, 100%)", background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: "var(--r-xl)", padding: 24, boxShadow: "0 40px 120px rgba(0,0,0,.6)" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: 16 }}>{t("tpl_new_title")}</h2>
          <button onClick={busy ? undefined : onClose} className="muted" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", border: "1px solid var(--line-2)" }}><Icon name="x" size={14} /></button>
        </div>
        <div className="col gap-12">
          <label className="col gap-6">
            <span className="muted" style={{ fontSize: 12 }}>{t("tpl_new_name")}</span>
            <input value={name} disabled={busy} onChange={e => setName(e.target.value)} style={fieldStyle} />
          </label>
          <label className="col gap-6">
            <span className="muted" style={{ fontSize: 12 }}>{t("tpl_new_desc")}</span>
            <input value={desc} disabled={busy} onChange={e => setDesc(e.target.value)} style={fieldStyle} />
          </label>
          <div className="col gap-6">
            <span className="muted" style={{ fontSize: 12 }}>{t("tpl_new_file")}</span>
            <input ref={fileRef} type="file" accept=".xlsx" onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              style={{ ...fieldStyle, textAlign: "left", cursor: "pointer", color: file ? "var(--text-1)" : "var(--text-3)" }}>
              {file ? file.name : "…"}
            </button>
          </div>
          {err && <span style={{ fontSize: 12.5, color: "var(--bad)" }}>{err}</span>}

          {busy && (
            <div className="col gap-6">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted" style={{ fontSize: 12 }}>{stage}</span>
                <span className="mono dim" style={{ fontSize: 11.5 }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", transition: "width .3s var(--ease)" }} />
              </div>
            </div>
          )}

          {phase === "failed" && fail && (
            <div role="alert" style={{ background: "var(--bad-bg)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
              <span style={{ fontSize: 12.5, color: "var(--bad)" }}>{t(FAIL_KEY[fail])}</span>
            </div>
          )}

          <div className="row gap-10" style={{ justifyContent: "flex-end", marginTop: 6 }}>
            <Btn variant="ghost" size="md" onClick={onClose} disabled={busy}>{t("cancel")}</Btn>
            {phase === "failed" ? (
              <Btn variant="primary" size="md" icon="spin" onClick={create} disabled={!file || !name.trim()}>{t("retry")}</Btn>
            ) : (
              <Btn variant="primary" size="md" icon="plus" onClick={create} disabled={busy || !file || !name.trim()}>{t("tpl_new_create")}</Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Portal: the overlay must dim the WHOLE app window regardless of ancestor CSS
  // (the gallery subtree is not a reliable fixed-positioning root). The modal only
  // mounts on user click, so document is always available.
  return createPortal(modal, document.body);
}
