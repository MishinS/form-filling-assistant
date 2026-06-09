import type { ExtractionModel, LlmFieldResult } from "./types";
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
    async extract(fields: ExtractField[], text: string): Promise<LlmFieldResult[]> {
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
      for (const model of candidates) {
        try {
          const res = await fetch(ENDPOINT, {
            method: "POST",
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
            continue;
          }
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const txt = data?.choices?.[0]?.message?.content;
          if (!txt) {
            lastErr = new Error(`Пустой ответ модели (${model})`);
            continue;
          }
          return parseFields(txt);
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error(String(e));
        }
      }
      throw lastErr;
    },
  };
}
