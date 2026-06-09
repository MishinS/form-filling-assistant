"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { isValidPassword } from "@/lib/auth/register";
import { Card, Btn } from "@/components/primitives";

const fieldStyle = { background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", padding: "10px 12px", fontSize: 14, outline: "none", width: "100%" } as const;

export default function PasswordCard({ editable }: { editable: boolean }) {
  const { t } = useI18n();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const can = editable && cur.length > 0 && isValidPassword(next) && !busy;

  async function submit() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({ error: "server" }))) as { error?: string };
        const text = error === "wrong_password" ? t("set_err_pw_current")
          : error === "password" ? t("set_err_pw_weak")
          : error === "env_account" ? t("set_readonly_env")
          : t("set_err_generic");
        setMsg({ kind: "err", text });
      } else {
        setCur(""); setNext(""); setMsg({ kind: "ok", text: t("set_pw_changed") });
      }
    } catch {
      setMsg({ kind: "err", text: t("set_err_generic") });
    } finally { setBusy(false); }
  }

  return (
    <Card pad={22}>
      <div className="col gap-16">
        <h2 style={{ fontSize: 15 }}>{t("set_password")}</h2>
        <label className="col gap-6">
          <span className="muted" style={{ fontSize: 12 }}>{t("set_current_pw")}</span>
          <input type="password" value={cur} disabled={!editable || busy} onChange={(e) => setCur(e.target.value)} style={fieldStyle} />
        </label>
        <label className="col gap-6">
          <span className="muted" style={{ fontSize: 12 }}>{t("set_new_pw")}</span>
          <input type="password" value={next} disabled={!editable || busy} onChange={(e) => setNext(e.target.value)} style={fieldStyle} />
        </label>
        {!editable && <span className="muted" style={{ fontSize: 12.5 }}>{t("set_readonly_env")}</span>}
        {msg && <span style={{ fontSize: 12.5, color: msg.kind === "ok" ? "var(--ok)" : "var(--bad)" }}>{msg.text}</span>}
        <div className="row"><Btn variant="primary" size="md" onClick={submit} disabled={!can}>{t("set_change_pw")}</Btn></div>
      </div>
    </Card>
  );
}
