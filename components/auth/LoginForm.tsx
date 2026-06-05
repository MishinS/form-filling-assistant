"use client";
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Logo, Btn } from "@/components/primitives";

export default function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  // Only allow same-origin relative paths — guards against open-redirect, since
  // redirect:false bypasses NextAuth's own callbackUrl sanitisation.
  const rawCallback = params.get("callbackUrl") || "/";
  const callbackUrl = rawCallback.startsWith("/") && !rawCallback.startsWith("//") ? rawCallback : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError(true);
      setBusy(false);
      return;
    }
    router.push(callbackUrl);
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
          <h1 style={{ fontSize: 22 }}>{t("login_title")}</h1>
          <p className="muted" style={{ fontSize: 13 }}>{t("login_sub")}</p>
        </div>
        <label className="col gap-6" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
          {t("login_email")}
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </label>
        <label className="col gap-6" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
          {t("login_password")}
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        </label>
        {error && <div role="alert" style={{ fontSize: 12.5, color: "var(--bad)" }}>{t("login_error")}</div>}
        <Btn variant="primary" size="lg" full disabled={busy}>
          {busy ? t("login_loading") : t("login_submit")}
        </Btn>
        <Link href="/register" style={{ fontSize: 12.5, color: "var(--text-3)", textAlign: "center" }}>{t("login_no_account")}</Link>
      </form>
    </div>
  );
}
