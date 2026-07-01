"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { isTauri } from "@/lib/desktop/tauri";
import { Card, Btn } from "@/components/primitives";

type Status = "idle" | "checking" | "uptodate" | "available" | "failed";

export default function AboutCard() {
  const { t } = useI18n();
  const [version, setVersion] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/api/app").then(({ getVersion }) => getVersion()).then(setVersion).catch(() => {});
  }, []);

  if (!isTauri()) return null;

  const check = async () => {
    setStatus("checking");
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      setStatus(update ? "available" : "uptodate");
    } catch {
      setStatus("failed");
    }
  };

  const msg = status === "checking" ? t("about_checking")
    : status === "uptodate" ? t("about_uptodate")
    : status === "available" ? t("about_available")
    : status === "failed" ? t("about_check_failed") : "";

  return (
    <Card pad={22}>
      <div className="col gap-16">
        <h2 style={{ fontSize: 15 }}>{t("about_title")}</h2>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13 }}>{t("about_version")}: <span className="mono">{version || "—"}</span></span>
          <Btn variant="subtle" size="sm" onClick={check} disabled={status === "checking"}>{t("about_check")}</Btn>
        </div>
        {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
      </div>
    </Card>
  );
}
