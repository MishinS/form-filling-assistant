"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "next-auth";
import { SessionProvider, useSession, signIn } from "next-auth/react";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider, useI18n } from "@/lib/i18n";
import type { ThemeMode } from "@/lib/theme-core";
import { Logo, Btn } from "@/components/primitives";
import ThemeToggle from "@/components/shell/ThemeToggle";
import { ModelContext, TemplateMappingContext, TemplatesContext } from "@/components/shell/AppShell";
import { GuestContext } from "@/components/shell/GuestContext";
import { WizardModal } from "@/components/wizard/WizardModal";
import { PT_FIELDS } from "@/lib/extract/fields";
import { TEMPLATES } from "@/lib/seed/pt";
import { DEFAULT_MODEL } from "@/lib/extract/llm/catalog";

function GuestWizard() {
  const { t } = useI18n();
  const { status } = useSession();
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") void signIn("guest", { redirect: false });
  }, [status]);

  if (status !== "authenticated") {
    return <p className="muted" style={{ textAlign: "center", marginTop: 80 }}>{t("guest_loading")}</p>;
  }

  return (
    <TemplatesContext.Provider value={{ templates: TEMPLATES, nameOf: (id) => id === "pt" ? { ru: TEMPLATES[0].name_ru, en: TEMPLATES[0].name_en } : undefined }}>
      <TemplateMappingContext.Provider value={{ fields: PT_FIELDS, setFields: () => {}, resetFields: () => {} }}>
        <ModelContext.Provider value={{ model, setModel }}>
          <GuestContext.Provider value={{ guest: true }}>
            <div style={{ padding: "24px 16px 64px" }}>
              <div style={{ maxWidth: "min(1080px, 100%)", margin: "0 auto 24px", textAlign: "center" }}>
                <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.15 }}>{t("guest_hero_h")}</h1>
                <p className="muted" style={{ fontSize: 15, marginTop: 10, maxWidth: 560, marginInline: "auto" }}>{t("guest_hero_sub")}</p>
                <p className="mono dim" style={{ fontSize: 11.5, marginTop: 12 }}>{t("guest_hero_note")}</p>
              </div>
              <WizardModal key={key} start={0} embedded onClose={() => setKey((k) => k + 1)} />
            </div>
          </GuestContext.Provider>
        </ModelContext.Provider>
      </TemplateMappingContext.Provider>
    </TemplatesContext.Provider>
  );
}

function GuestHeader() {
  const { t } = useI18n();
  return (
    <header className="row" style={{ justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
      {/* Logo doubles as a "fresh entry" — hard-reload to the portal root. */}
      <button type="button" onClick={() => window.location.assign("/")} title={t("home_reload")}
        className="row gap-12" style={{ background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
        onMouseEnter={e => { e.currentTarget.style.opacity = ".7"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
        <span className="logo-host" style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface-3)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center" }}><Logo size={15} /></span>
        <span style={{ fontWeight: 700 }}>Form-Filling Assistant</span>
      </button>
      <div className="row gap-12">
        <ThemeToggle />
        <Link href="/login"><Btn variant="quiet" size="md">{t("guest_login")}</Btn></Link>
        <Link href="/register"><Btn variant="primary" size="md">{t("guest_register")}</Btn></Link>
      </div>
    </header>
  );
}

export default function GuestShell({ session, initialMode, initialLang }: { session: Session | null; initialMode: ThemeMode; initialLang: "ru" | "en" }) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider initialMode={initialMode}>
        <I18nProvider initialLang={initialLang}>
          <GuestHeader />
          <GuestWizard />
        </I18nProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
