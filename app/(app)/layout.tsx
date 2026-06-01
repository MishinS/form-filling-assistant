import { I18nProvider } from "@/lib/i18n";
import AppShell from "@/components/shell/AppShell";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <I18nProvider><AppShell>{children}</AppShell></I18nProvider>;
}
