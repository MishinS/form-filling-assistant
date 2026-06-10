"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { useI18n } from "@/lib/i18n";
import { Btn, Icon } from "@/components/primitives";
import { MIME } from "@/lib/parse/types";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const fieldStyle = { background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", padding: "10px 12px", fontSize: 14, outline: "none", width: "100%" } as const;

export default function NewTemplateModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    setErr(null);
    if (!f) return;
    if ((f.type && f.type !== MIME.xlsx && !f.name.toLowerCase().endsWith(".xlsx")) || f.size > MAX_BYTES) {
      setErr(t("tpl_new_err_file"));
      return;
    }
    setFile(f);
  };

  const create = async () => {
    if (!file || !name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const { url } = await upload(file.name, file, {
        access: "public", handleUploadUrl: "/api/blob/template", contentType: MIME.xlsx,
      });
      const res = await fetch("/api/templates", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), desc: desc.trim(), url }),
      });
      if (!res.ok) throw new Error("create");
      const { id } = (await res.json()) as { id: string };
      router.push(`/templates/${id}`);
      router.refresh();
    } catch {
      setErr(t("tpl_new_err"));
      setBusy(false);
    }
  };

  return (
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
          {busy && <span className="mono dim" style={{ fontSize: 11.5 }}>{t("tpl_new_scanning")}</span>}
          <div className="row gap-10" style={{ justifyContent: "flex-end", marginTop: 6 }}>
            <Btn variant="ghost" size="md" onClick={onClose} disabled={busy}>{t("cancel")}</Btn>
            <Btn variant="primary" size="md" icon="plus" onClick={create} disabled={busy || !file || !name.trim()}>{t("tpl_new_create")}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
