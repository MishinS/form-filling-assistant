import { I18nProvider } from "@/lib/i18n";
import AppShell from "@/components/shell/AppShell";
import { auth } from "@/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = { name: session?.user?.name ?? "", email: session?.user?.email ?? "" };
  return (
    <I18nProvider>
      <AppShell user={user}>{children}</AppShell>
    </I18nProvider>
  );
}
