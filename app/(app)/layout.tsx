import { cookies } from "next/headers";
import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { parseThemeMode } from "@/lib/theme-core";
import { AccentProvider } from "@/lib/accent";
import { DEFAULT_ACCENT, type AccentId } from "@/lib/accent-core";
import { getAccent } from "@/lib/db/accents";
import AppShell from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/shell/Toast";
import { auth } from "@/auth";
import { getMapping } from "@/lib/db/mappings";
import { listTemplates, listTemplateNames } from "@/lib/db/templates";
import { TEMPLATES, type UiTemplate } from "@/lib/seed/pt";
import type { ExtractField } from "@/lib/extract/fields";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role === "guest") {
    const { redirect } = await import("next/navigation");
    redirect("/");
  }
  const user = { name: session?.user?.name ?? "", email: session?.user?.email ?? "", image: session?.user?.image ?? null };

  const jar = await cookies();
  const initialMode = parseThemeMode(jar.get("theme")?.value);
  const initialLang = jar.get("lang")?.value === "en" ? "en" : "ru";

  let initialFields: ExtractField[] | undefined;
  if (user.email) {
    try {
      initialFields = (await getMapping(user.email, "pt")) ?? undefined;
    } catch {
      // DB unreachable → undefined → AppShell falls back to PT_FIELDS. Never 500 the app.
    }
  }

  let initialAccent: AccentId = DEFAULT_ACCENT;
  if (user.email) {
    try {
      initialAccent = (await getAccent(user.email)) ?? DEFAULT_ACCENT;
    } catch {
      // DB unreachable → default blue. Never 500 the app.
    }
  }

  let templates: UiTemplate[] = TEMPLATES;
  const templateNames: Record<string, { ru: string; en: string }> = {
    pt: { ru: TEMPLATES[0].name_ru, en: TEMPLATES[0].name_en },
  };
  if (user.email) {
    try {
      const rows = await listTemplates(user.email);
      const custom = rows.filter(r => r.userId !== null).map(r => ({
        id: r.id, code: r.code, name_ru: r.nameRu, name_en: r.nameEn,
        desc_ru: r.descRu, desc_en: r.descEn, format: r.format.toUpperCase(),
        sheets: r.sheets, fields: r.defaultFields?.length ?? 0, updated: "", own: true,
      }));
      templates = [...TEMPLATES, ...custom];
      const names = await listTemplateNames(user.email);
      for (const n of names) templateNames[n.id] = { ru: n.nameRu, en: n.nameEn };
    } catch {
      // DB unreachable → built-ins only. Never 500 the app.
    }
  }

  return (
    <SessionProvider session={session}>
      <ThemeProvider initialMode={initialMode}>
        <AccentProvider initialAccent={initialAccent}>
          <I18nProvider initialLang={initialLang}>
            <ToastProvider>
              <AppShell user={user} initialFields={initialFields} templates={templates} templateNames={templateNames}>{children}</AppShell>
            </ToastProvider>
          </I18nProvider>
        </AccentProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
