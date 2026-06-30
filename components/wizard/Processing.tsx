"use client";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon, Btn } from "@/components/primitives";
import { ModelContext } from "@/components/shell/AppShell";
import { FREE_MODELS, modelLabel } from "@/lib/extract/llm/catalog";
import type { UploadFile } from "@/lib/upload/client";
import type { ParsedDoc } from "@/lib/parse/types";
import type { ExtractedValue } from "@/lib/types";
import type { ExtractField } from "@/lib/extract/fields";
import RaceList, { type RaceItem } from "@/components/wizard/RaceList";
import { isTauri } from "@/lib/desktop/tauri";
import { runLocalExtract } from "@/lib/extract/llm/run-local-extract";

type Props = {
  sources: UploadFile[];
  model: string;
  templateId: string;
  fields: ExtractField[];
  onDone: (values: ExtractedValue[], docs: ParsedDoc[], warnings: string[]) => void;
  onBack: () => void;
};

type Phase = "parsing" | "extracting" | "llm-failed" | "error";
type ResultEvent = { values: ExtractedValue[]; warnings: string[]; llmFailed: boolean; usedModel: string | null };


export default function Processing({ sources, model, templateId, fields, onDone, onBack }: Props) {
  const { t } = useI18n();
  const { setModel } = useContext(ModelContext);
  const [phase, setPhase] = useState<Phase>("parsing");
  const [error, setError] = useState<string | null>(null);
  const [race, setRace] = useState<RaceItem[]>([]); // модель → статус в текущей гонке
  const [tried, setTried] = useState<string[]>([]); // failed model display names
  const [result, setResult] = useState<ResultEvent | null>(null); // last terminal result (for "continue")
  const [failedLocal, setFailedLocal] = useState(false); // the model that just failed was a desktop local: one
  const [etaMs, setEtaMs] = useState<number | null>(null);
  const [localPct, setLocalPct] = useState(0);
  const [localDone, setLocalDone] = useState(false);
  const etaTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const docsRef = useRef<ParsedDoc[]>([]);
  const started = useRef(false);

  // Stream /api/extract, dispatching NDJSON events. Re-runnable (retry / switch model).
  const runExtract = useCallback(async (docs: ParsedDoc[], modelId: string) => {
    setPhase("extracting");
    setTried([]);
    setRace([]);
    setResult(null);
    setError(null);
    setEtaMs(null);
    setLocalPct(0);
    setLocalDone(false);
    if (etaTimer.current) { clearInterval(etaTimer.current); etaTimer.current = null; }
    try {
      const failed: string[] = [];
      const finalBox: { value: ResultEvent | null } = { value: null };
      let receivedEta = false;
      let buf = "";
      const handleLine = (line: string) => {
        if (!line) return;
        const ev = JSON.parse(line) as
          | { type: "attempt"; model: string }
          | { type: "attempt-fail"; model: string; reason?: string }
          | { type: "attempt-win"; model: string }
          | { type: "local-eta"; ms: number }
          | ({ type: "result" } & ResultEvent);
        if (ev.type === "attempt") {
          setRace((r) => (r.some((x) => x.model === ev.model) ? r : [...r, { model: ev.model, status: "running" }]));
        } else if (ev.type === "attempt-fail") {
          failed.push(modelLabel(ev.model));
          setTried([...failed]);
          setRace((r) => r.map((x) => (x.model === ev.model ? { ...x, status: "fail" } : x)));
        } else if (ev.type === "attempt-win") {
          setRace((r) => r.map((x) => (x.model === ev.model ? { ...x, status: "win" } : x)));
        } else if (ev.type === "local-eta") {
          setEtaMs(ev.ms);
          receivedEta = true;
          const started = Date.now();
          if (etaTimer.current) clearInterval(etaTimer.current);
          etaTimer.current = setInterval(() => {
            const frac = Math.min(0.95, (Date.now() - started) / ev.ms);
            setLocalPct(Math.round(frac * 100));
          }, 250);
        } else if (ev.type === "result") {
          finalBox.value = { values: ev.values, warnings: ev.warnings, llmFailed: ev.llmFailed, usedModel: ev.usedModel };
        }
      };
      if (isTauri() && modelId.startsWith("local:")) {
        // Desktop local model: run extraction in the webview; feed the same consumer.
        await runLocalExtract(docs, modelId, fields, (line) => handleLine(line.trim()));
      } else {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, model: modelId, docs, fields }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            handleLine(buf.slice(0, nl).trim());
            buf = buf.slice(nl + 1);
          }
        }
        buf += decoder.decode(); // flush any bytes held in the decoder's internal state
        handleLine(buf.trim());
      }
      const final = finalBox.value;
      if (!final) throw new Error(t("stream_empty"));
      setResult(final);
      if (etaTimer.current) { clearInterval(etaTimer.current); etaTimer.current = null; }
      if (!final.llmFailed && receivedEta) {
        setLocalPct(100);
        setLocalDone(true);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (final.llmFailed) {
        // Honest copy: a local model failing is not the cloud "free pool overloaded" case.
        setFailedLocal(isTauri() && modelId.startsWith("local:"));
        setPhase("llm-failed");
      } else {
        onDone(final.values, docs, final.warnings);
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [templateId, fields, onDone, t]);

  // Parse then extract. Parse runs once per mount (ref-guarded).
  const start = useCallback(async () => {
    setPhase("parsing");
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: sources.map((f) => ({ fileId: f.fileId, url: f.blobUrl, name: f.name, mime: f.mime })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { docs } = (await res.json()) as { docs: ParsedDoc[] };
      const allEmpty = docs.length > 0 && docs.every((d) => d.blocks.length === 0);
      if (allEmpty) { setError(t("parse_empty")); setPhase("error"); return; }
      docsRef.current = docs;
      await runExtract(docs, model);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [sources, model, runExtract, t]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
    // Run exactly once on mount (ref-guarded); props captured intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (etaTimer.current) clearInterval(etaTimer.current); }, []);

  // --- hard parse/stream error ---
  if (phase === "error") {
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

  // --- LLM failure panel ---
  if (phase === "llm-failed") {
    return (
      <div className="col gap-16" style={{ maxWidth: 480, margin: "48px auto 0", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, margin: "0 auto", borderRadius: 14, display: "grid", placeItems: "center",
          background: "var(--bad-bg)", color: "var(--bad)" }}><Icon name="alert" size={26} /></div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{t(failedLocal ? "llm_failed_local_title" : "llm_failed_title")}</div>
        {failedLocal ? (
          <div className="muted" style={{ fontSize: 13 }}>{t("llm_failed_local_d")}</div>
        ) : result?.warnings?.length ? (
          <div className="muted" style={{ fontSize: 13 }}>{result.warnings.join(" ")}</div>
        ) : null}
        {tried.length > 0 && (
          <div className="mono dim" style={{ fontSize: 11.5 }}>{t("llm_tried")} {tried.join(" · ")}</div>
        )}

        {/* switch-model picker */}
        <div className="col gap-8" style={{ marginTop: 4 }}>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: ".07em", textTransform: "uppercase" }}>{t("switch_model")}</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {FREE_MODELS.map((m) => (
              <button key={m.id} onClick={() => { setModel(m.id); void runExtract(docsRef.current, m.id); }}
                className="mono" style={{ fontSize: 11.5, padding: "6px 11px", borderRadius: 99,
                  border: `1px solid ${m.id === model ? "var(--accent)" : "var(--line-2)"}`,
                  color: m.id === model ? "var(--accent)" : "var(--text-2)", background: "var(--surface-1)" }}>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="row" style={{ justifyContent: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <Btn variant="primary" size="md" icon="spin" onClick={() => void runExtract(docsRef.current, model)}>{t("retry")}</Btn>
          {result && (
            <Btn variant="quiet" size="md" iconRight="arrowR"
              onClick={() => onDone(result.values, docsRef.current, result.warnings)}>{t("continue_no_llm")}</Btn>
          )}
          <Btn variant="quiet" size="md" icon="arrowL" onClick={onBack}>{t("back")}</Btn>
        </div>
      </div>
    );
  }

  // --- parsing / extracting ---
  const parsing = phase === "parsing";
  return (
    <div className="col gap-16" style={{ maxWidth: 460, margin: "80px auto 0", textAlign: "center" }}>
      <div className="spin" style={{ width: 56, height: 56, margin: "0 auto", color: "var(--accent)" }}>
        <Icon name="spin" size={56} stroke={1.5} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 16 }}>
        {parsing ? t("proc_parse") : t("proc_racing")}
      </div>
      <div className="muted" style={{ fontSize: 13 }}>
        {parsing ? t("proc_parse_d") : t("proc_extract_d")}
      </div>
      {!parsing && (etaMs !== null ? (
        <div className="col gap-10" style={{ width: "100%" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted" style={{ fontSize: 12 }}>{localDone ? t("st_done") : t("proc_racing")}</span>
            <span className="mono dim" style={{ fontSize: 11.5 }}>{localPct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
            <div style={{ width: `${localPct}%`, height: "100%", background: localDone ? "var(--ok)" : "var(--accent)", transition: "width .3s var(--ease)" }} />
          </div>
        </div>
      ) : (
        <RaceList items={race} />
      ))}
    </div>
  );
}
