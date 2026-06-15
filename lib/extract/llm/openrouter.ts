import type { ExtractionModel, LlmFieldResult, OnAttempt } from "./types";
import { ModelNotConfigured } from "./types";
import type { ExtractField } from "../fields";
import { FREE_MODEL_IDS, isFreeSlug, isPaidModel, PAID_LAST_RESORT } from "./catalog";
import { buildExtractionPrompt } from "./prompt";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Curated free models tried in order when the primary is a free slug. Single
// source of truth is the shared catalog (also drives the sidebar picker). We fall
// back client-side (not via OpenRouter's `models[]`) because that only retries on
// 429/5xx — a 400 from a model that rejects response_format would otherwise abort
// the whole chain.
const FREE_FALLBACKS = FREE_MODEL_IDS;

// A hung free-pool model must not eat the route budget (/api/extract maxDuration=60):
// each attempt is aborted after ATTEMPT_TIMEOUT_MS, and the whole chain gives up at
// CHAIN_DEADLINE_MS so the NDJSON stream always flushes a terminal result before the
// platform kills the function mid-stream (the client would otherwise see a dead
// «Пустой ответ сервера» screen with no retry). Healthy free models have been observed
// to take ~22s on Vercel, so the per-attempt timeout must stay comfortably above that.
// Exported for lib/templates/scan.ts, whose own OpenRouter chain runs under the
// same 60s route budget (/api/templates).
export const ATTEMPT_TIMEOUT_MS = 30_000;
export const CHAIN_DEADLINE_MS = 50_000;

// The free pool runs only until FREE_PHASE_DEADLINE_MS so a slice of the chain
// budget is RESERVED for the paid last-resort tail — a hung free model must not
// starve it. The tail then runs under PAID_TIMEOUT_MS within CHAIN_DEADLINE_MS.
// Worst case: 35s free phase + 12s paid = 47s < 50s deadline < 60s route maxDuration.
// PAID_TIMEOUT_MS applies only when the paid model is the reserved TAIL; chosen as a
// primary it runs under the normal ATTEMPT_TIMEOUT_MS.
// Exported for lib/templates/scan.ts, which reuses the same reservation.
export const FREE_PHASE_DEADLINE_MS = 35_000;
export const PAID_TIMEOUT_MS = 12_000;

// Tolerate models that wrap JSON in a ```json fence despite response_format.
function parseFields(txt: string): LlmFieldResult[] {
  const cleaned = txt.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as { fields?: LlmFieldResult[] };
  return parsed.fields ?? [];
}

// OpenAI-compatible adapter for OpenRouter (https://openrouter.ai).
// `modelName` is a full OpenRouter slug, e.g. "openai/gpt-oss-120b:free" or the
// "openrouter/free" auto-router.
export function openrouterModel(modelName: string): ExtractionModel {
  return {
    id: modelName,
    async extract(fields: ExtractField[], text: string, onAttempt?: OnAttempt): Promise<LlmFieldResult[]> {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) throw new ModelNotConfigured(modelName);

      const prompt = buildExtractionPrompt(
        fields,
        text,
        'Ответь СТРОГО валидным JSON вида {"fields":[{"fieldId":"f1","value":"...","confidence":"high|med|low","sourceHint":"..."}]} без markdown и пояснений.',
      );

      // Build the candidate chain so the paid last-resort is ALWAYS present:
      //   free primary → [free, ...free pool, PAID tail]
      //   paid primary → [PAID, ...free pool]   (user opted in; paid runs first)
      //   unknown slug → [slug, PAID tail]      (preserve degradation, still backed)
      let candidates: string[];
      if (isPaidModel(modelName)) {
        candidates = [modelName, ...FREE_FALLBACKS];
      } else if (isFreeSlug(modelName)) {
        candidates = [modelName, ...FREE_FALLBACKS, PAID_LAST_RESORT.id];
      } else {
        candidates = [modelName, PAID_LAST_RESORT.id];
      }
      candidates = Array.from(new Set(candidates));

      // The reserved paid tail is the paid model only when it sits AFTER the primary
      // (index > 0). As primary (index 0) it just runs first under the normal budget.
      const paidIdx = candidates.indexOf(PAID_LAST_RESORT.id);
      const paidTailIdx = paidIdx > 0 ? paidIdx : -1;

      let lastErr: Error = new Error("Нет доступных моделей OpenRouter");
      const t0 = Date.now();
      for (let i = 0; i < candidates.length; i++) {
        const elapsed = Date.now() - t0;
        const isTail = i === paidTailIdx;
        // Free candidates are bounded by the free-phase deadline when a paid tail is
        // reserved after them; the tail itself runs under the full chain deadline.
        const phaseDeadline = (isTail || paidTailIdx < 0) ? CHAIN_DEADLINE_MS : FREE_PHASE_DEADLINE_MS;
        const phaseRemaining = phaseDeadline - elapsed;
        if (phaseRemaining <= 0) continue; // free phase exhausted → fall through to the paid tail
        const model = candidates[i];
        onAttempt?.({ phase: "start", model, index: i + 1, total: candidates.length });
        const perAttempt = isTail ? PAID_TIMEOUT_MS : ATTEMPT_TIMEOUT_MS;
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), Math.min(perAttempt, phaseRemaining));
        try {
          const res = await fetch(ENDPOINT, {
            method: "POST",
            signal: ac.signal,
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
              // Optional ranking headers — harmless if the env var is absent.
              "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://form-filling-assistant.local",
              "X-Title": "Form-Filling Assistant",
            },
            body: JSON.stringify({
              model,
              temperature: 0,
              response_format: { type: "json_object" },
              messages: [{ role: "user", content: prompt }],
            }),
          });
          if (!res.ok) {
            lastErr = new Error(`OpenRouter HTTP ${res.status} (${model})`);
            onAttempt?.({ phase: "fail", model, reason: lastErr.message });
            continue;
          }
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const txt = data?.choices?.[0]?.message?.content;
          if (!txt) {
            lastErr = new Error(`Пустой ответ модели (${model})`);
            onAttempt?.({ phase: "fail", model, reason: lastErr.message });
            continue;
          }
          return parseFields(txt);
        } catch (e) {
          lastErr = ac.signal.aborted
            ? new Error(`Таймаут ответа модели (${model})`)
            : e instanceof Error ? e : new Error(String(e));
          onAttempt?.({ phase: "fail", model, reason: lastErr.message });
        } finally {
          clearTimeout(timer);
        }
      }
      throw lastErr;
    },
  };
}
