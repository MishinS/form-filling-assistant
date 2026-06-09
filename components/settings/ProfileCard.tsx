"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { Card, Btn } from "@/components/primitives";
import type { SessionUser } from "@/components/shell/AppShell";

const fieldStyle = { background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", padding: "10px 12px", fontSize: 14, outline: "none", width: "100%" } as const;

export default function ProfileCard({ user, editable }: { user: SessionUser; editable: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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

  return (
    <Card pad={22}>
      <div className="col gap-16">
        <h2 style={{ fontSize: 15 }}>{t("set_profile")}</h2>
        <div className="row gap-16">
          <span style={{ width: 52, height: 52, borderRadius: 99, background: "var(--surface-hi)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 600, flex: "none" }}>{initials}</span>
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
