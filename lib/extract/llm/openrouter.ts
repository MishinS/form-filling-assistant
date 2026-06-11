import type { ExtractionModel, LlmFieldResult, OnAttempt } from "./types";
import { ModelNotConfigured } from "./types";
import type { ExtractField } from "../fields";
import { FREE_MODEL_IDS } from "./catalog";
import { buildExtractionPrompt } from "./prompt";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Curated free models tried in order when the primary is a ":free" slug. Single
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

// Tolerate models that wrap JSON in a ```json fence despite response_format.
function parseFields(txt: string): LlmFieldResult[] {
  const cleaned = txt.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as { fields?: LlmFieldResult[] };
  return parsed.fields ?? [];
}

// OpenAI-compatible adapter for OpenRouter (https://openrouter.ai).
// `modelName` is a full OpenRouter slug, e.g. "moonshotai/kimi-k2.6:free".
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

      // Primary first, then the curated chain (deduped) — only for ":free" slugs.
      const candidates = modelName.endsWith(":free")
        ? [modelName, ...FREE_FALLBACKS.filter((m) => m !== modelName)]
        : [modelName];

      let lastErr: Error = new Error("Нет доступных моделей OpenRouter");
      const t0 = Date.now();
      for (let i = 0; i < candidates.length; i++) {
        const remaining = CHAIN_DEADLINE_MS - (Date.now() - t0);
        if (remaining <= 0) break;
        const model = candidates[i];
        onAttempt?.({ phase: "start", model, index: i + 1, total: candidates.length });
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), Math.min(ATTEMPT_TIMEOUT_MS, remaining));
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
