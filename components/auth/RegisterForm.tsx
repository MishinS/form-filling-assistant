"use client";
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Logo, Btn } from "@/components/primitives";

export default function RegisterForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errKey, setErrKey] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrKey(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name, password, inviteCode }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const code = (data as { error?: string }).error;
      setErrKey(code === "invite" ? "register_err_invite" : code === "email_taken" ? "register_err_taken" : code === "server" ? "register_err_server" : "register_err_generic");
      setBusy(false);
      return;
    }
    // Auto sign-in with the just-created credentials.
    const signRes = await signIn("credentials", { email, password, redirect: false });
    if (signRes?.error) { setBusy(false); router.push("/login"); return; }
    window.location.assign("/");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 42, padding: "0 12px", borderRadius: "var(--r-md)",
    border: "1px solid var(--line-2)", background: "var(--surface-1)", color: "var(--text)", fontSize: 14,
  };

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={submit} className="col gap-16 fade-in"
        style={{ width: "min(380px, 100%)", padding: 32, borderRadius: "var(--r-xl)",
          border: "1px solid var(--line)", background: "var(--surface-1)" }}>
        <div className="col gap-10" style={{ alignItems: "center", textAlign: "center" }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-3)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center" }}><Logo size={18} /></span>
          <h1 style={{ fontSize: 22 }}>{t("register_title")}</h1>
          <p className="muted" style={{ fontSize: 13 }}>{t("register_sub")}</p>
        </div>
        <label className="col gap-6" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
          {t("login_email")}
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </label>
        <label className="col gap-6" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
          {t("register_name")}
          <input type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <label className="col gap-6" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
          {t("login_password")}
          <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        </label>
        <label className="col gap-6" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
          {t("register_invite")}
          <input type="text" required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} style={inputStyle} />
        </label>
        {errKey && <div role="alert" style={{ fontSize: 12.5, color: "var(--bad)" }}>{t(errKey)}</div>}
        <Btn variant="primary" size="lg" full disabled={busy}>
          {busy ? t("register_loading") : t("register_submit")}
        </Btn>
        <Link href="/login" style={{ fontSize: 12.5, color: "var(--text-3)", textAlign: "center" }}>{t("register_have_account")}</Link>
      </form>
    </div>
  );
}
