"use client";
import { useI18n } from "@/lib/i18n";

export default function Stepper({ step }: { step: number }) {
  const { t } = useI18n();
  const steps = ["step_upload", "step_process", "step_review", "step_done"];
  return (
    <div className="row gap-12" style={{ width: "100%", maxWidth: 560 }}>
      {steps.map((s, i) => (
        <div key={s} className="grow col gap-8">
          <div style={{ height: 3, borderRadius: 99, background: "var(--line-2)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, background: i <= step ? "var(--accent)" : "transparent",
              width: i < step ? "100%" : i === step ? "100%" : "0%", transition: "width .5s var(--ease)" }} />
          </div>
          <div className="row gap-6" style={{ color: i <= step ? "var(--text)" : "var(--text-3)" }}>
            <span className="mono" style={{ fontSize: 10.5 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ fontSize: 12, fontWeight: i === step ? 600 : 500 }}>{t(s)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
