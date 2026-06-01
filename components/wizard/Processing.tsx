"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon, Btn } from "@/components/primitives";
import type { UploadFile } from "@/lib/upload/client";
import type { ParsedDoc } from "@/lib/parse/types";

type Props = {
  sources: UploadFile[];
  onDone: (docs: ParsedDoc[]) => void;
  onBack: () => void;
};

export default function Processing({ sources, onDone, onBack }: Props) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
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
        onDone(docs);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [sources, onDone, t]);

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
      <div style={{ fontWeight: 600, fontSize: 16 }}>{t("processing_title")}</div>
      <div className="muted" style={{ fontSize: 13 }}>{t("processing_sub")} · {sources.length}</div>
    </div>
  );
}
