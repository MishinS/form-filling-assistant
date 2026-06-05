import { Suspense } from "react";
import { I18nProvider } from "@/lib/i18n";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <I18nProvider>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </I18nProvider>
  );
}
