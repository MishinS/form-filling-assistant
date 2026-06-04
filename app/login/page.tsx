import { Suspense } from "react";
import { I18nProvider } from "@/lib/i18n";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <I18nProvider>
      <Suspense>
        <LoginForm />
      </Suspense>
    </I18nProvider>
  );
}
