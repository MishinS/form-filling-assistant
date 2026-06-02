import type { ExtractionModel, LlmFieldResult } from "./types";
import { ModelNotConfigured } from "./types";
import type { ExtractField } from "../fields";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Curated free models with usable Russian, tried in order when the primary is a
// ":free" slug. We fall back client-side (not via OpenRouter's `models[]`) because
// that only retries on 429/5xx — a 400 from a model that rejects response_format
// would otherwise abort the whole chain. Slugs rotate; refresh against
// https://openrouter.ai/models?max_price=0 when extraction stops working.
const FREE_FALLBACKS = [
  "moonshotai/kimi-k2.6:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
];

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

      const specs = fields.map((f) => `- ${f.id}: ${f.label_ru} (${f.kind})`).join("\n");
      const prompt = [
        "Извлеки значения полей для российского «Платёжного требования» из текста документа ниже.",
        "Верни значение для каждого поля. Если значение не найдено — пустая строка и confidence \"low\".",
        'Ответь СТРОГО валидным JSON вида {"fields":[{"fieldId":"f1","value":"...","confidence":"high|med|low","sourceHint":"..."}]} без markdown и пояснений.',
        `Поля:\n${specs}`,
        `Текст документа:\n${text.slice(0, 12000)}`,
      ].join("\n\n");

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
