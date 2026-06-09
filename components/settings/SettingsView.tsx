"use client";
import { useI18n } from "@/lib/i18n";
import type { SessionUser } from "@/components/shell/AppShell";
import ProfileCard from "./ProfileCard";
import PasswordCard from "./PasswordCard";
import PreferencesCard from "./PreferencesCard";
import ModelCard from "./ModelCard";

export default function SettingsView({ user, editable }: { user: SessionUser; editable: boolean }) {
  const { t } = useI18n();
  return (
    <div className="col gap-24 fade-in" style={{ padding: "32px 36px", maxWidth: 760, margin: "0 auto" }}>
      <div className="col gap-4">
        <h1 style={{ fontSize: 22 }}>{t("nav_settings")}</h1>
        <span className="muted" style={{ fontSize: 13.5 }}>{t("settings_subtitle")}</span>
      </div>
      <ProfileCard user={user} editable={editable} />
      <PasswordCard editable={editable} />
      <PreferencesCard />
      <ModelCard />
    </div>
  );
}
