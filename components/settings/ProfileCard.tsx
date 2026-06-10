"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { upload } from "@vercel/blob/client";
import { useI18n } from "@/lib/i18n";
import { Card, Btn } from "@/components/primitives";
import type { SessionUser } from "@/components/shell/AppShell";

const fieldStyle = { background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", padding: "10px 12px", fontSize: 14, outline: "none", width: "100%" } as const;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const AVATAR_MAX = 2 * 1024 * 1024; // 2 MB

export default function ProfileCard({ user, editable }: { user: SessionUser; editable: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(user.name);
  const [image, setImage] = useState<string | null>(user.image);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (name || user.email || "?").trim().slice(0, 2).toUpperCase();
  const dirty = name.trim() !== user.name && name.trim().length > 0;

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({ error: "server" }))) as { error?: string };
        setMsg({ kind: "err", text: error === "name" ? t("set_err_name") : error === "env_account" ? t("set_readonly_env") : t("set_err_generic") });
      } else {
        await update({ name: name.trim() });
        router.refresh();
        setMsg({ kind: "ok", text: t("set_saved") });
      }
    } catch {
      setMsg({ kind: "err", text: t("set_err_generic") });
    } finally { setBusy(false); }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type) || file.size > AVATAR_MAX) {
      setMsg({ kind: "err", text: t("set_err_avatar") });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const { url } = await upload(file.name, file, {
        access: "public", handleUploadUrl: "/api/blob/avatar", contentType: file.type,
      });
      const res = await fetch("/api/account/avatar", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("save");
      setImage(url);
      await update({ image: url });
      router.refresh();
      setMsg({ kind: "ok", text: t("set_saved") });
    } catch {
      setMsg({ kind: "err", text: t("set_err_avatar") });
    } finally { setBusy(false); }
  }

  async function removeAvatar() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("del");
      setImage(null);
      await update({ image: null });
      router.refresh();
      setMsg({ kind: "ok", text: t("set_saved") });
    } catch {
      setMsg({ kind: "err", text: t("set_err_generic") });
    } finally { setBusy(false); }
  }

  return (
    <Card pad={22}>
      <div className="col gap-16">
        <h2 style={{ fontSize: 15 }}>{t("set_profile")}</h2>
        <div className="row gap-16" style={{ alignItems: "flex-start" }}>
          <div className="col gap-8" style={{ alignItems: "center", flex: "none", width: 72 }}>
            <span style={{ width: 52, height: 52, borderRadius: 99, overflow: "hidden", background: "var(--surface-hi)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 600 }}>
              {image
                ? <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : initials}
            </span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickAvatar} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="muted" style={{ fontSize: 11.5, textDecoration: "underline", textAlign: "center" }}>{t("set_avatar_upload")}</button>
            {image && <button onClick={removeAvatar} disabled={busy} className="dim" style={{ fontSize: 11 }}>{t("set_avatar_remove")}</button>}
          </div>
          <div className="col gap-12 grow">
            <label className="col gap-6">
              <span className="muted" style={{ fontSize: 12 }}>{t("set_name")}</span>
              <input value={name} disabled={!editable || busy} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
            </label>
            <label className="col gap-6">
              <span className="muted" style={{ fontSize: 12 }}>{t("set_email")}</span>
              <input value={user.email} disabled style={{ ...fieldStyle, color: "var(--text-2)" }} />
            </label>
          </div>
        </div>
        {!editable && <span className="muted" style={{ fontSize: 12.5 }}>{t("set_readonly_env")}</span>}
        {msg && <span style={{ fontSize: 12.5, color: msg.kind === "ok" ? "var(--ok)" : "var(--bad)" }}>{msg.text}</span>}
        <div className="row"><Btn variant="primary" size="md" onClick={save} disabled={!editable || !dirty || busy}>{t("set_save")}</Btn></div>
      </div>
    </Card>
  );
}
