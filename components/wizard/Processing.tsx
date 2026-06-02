"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon, Btn } from "@/components/primitives";
import type { UploadFile } from "@/lib/upload/client";
import type { ParsedDoc } from "@/lib/parse/types";
import type { ExtractedValue } from "@/lib/types";

type Props = {
  sources: UploadFile[];
  model: string;
  templateId: string;
  onDone: (values: ExtractedValue[], docs: ParsedDoc[], warnings: string[]) => void;
  onBack: () => void;
};

export default function Processing({ sources, model, templateId, onDone, onBack }: Props) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"parse" | "extract">("parse");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sources: sources.map(f => ({ fileId: f.fileId, url: f.blobUrl, name: f.name, mime: f.mime })),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { docs } = (await res.json()) as { docs: ParsedDoc[] };
        const allEmpty = docs.length > 0 && docs.every(d => d.blocks.length === 0);
        if (allEmpty) { setError(t("parse_empty")); return; }

        setStage("extract");
        const ex = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, model, docs }),
        });
        if (!ex.ok) throw new Error(`HTTP ${ex.status}`);
        const { values, warnings } = (await ex.json()) as { values: ExtractedValue[]; warnings?: string[] };
        onDone(values, docs, warnings ?? []);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    // Run exactly once on mount (ref-guarded); props are captured intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="col gap-16" style={{ maxWidth: 460, margin: "60px auto 0", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, margin: "0 auto", borderRadius: 14, display: "grid", placeItems: "center",
          background: "var(--bad-bg)", color: "var(--bad)" }}><Icon name="alert" size={26} /></div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{t("parse_failed")}</div>
        <div className="muted" style={{ fontSize: 13 }}>{error}</div>
        <div className="row" style={{ justifyContent: "center" }}>
          <Btn variant="quiet" size="md" icon="arrowL" onClick={onBack}>{t("back")}</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="col gap-16" style={{ maxWidth: 460, margin: "80px auto 0", textAlign: "center" }}>
      <div className="spin" style={{ width: 56, height: 56, margin: "0 auto", color: "var(--accent)" }}>
        <Icon name="spin" size={56} stroke={1.5} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 16 }}>{stage === "parse" ? t("proc_parse") : t("proc_extract")}</div>
      <div className="muted" style={{ fontSize: 13 }}>{stage === "parse" ? t("proc_parse_d") : t("proc_extract_d")}</div>
    </div>
  );
}
