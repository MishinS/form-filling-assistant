import { cookies } from "next/headers";
import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { parseThemeMode } from "@/lib/theme-core";
import AppShell from "@/components/shell/AppShell";
import { auth } from "@/auth";
import { getMapping } from "@/lib/db/mappings";
import type { ExtractField } from "@/lib/extract/fields";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = { name: session?.user?.name ?? "", email: session?.user?.email ?? "" };

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

  return (
    <SessionProvider session={session}>
      <ThemeProvider initialMode={initialMode}>
        <I18nProvider initialLang={initialLang}>
          <AppShell user={user} initialFields={initialFields}>{children}</AppShell>
        </I18nProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
