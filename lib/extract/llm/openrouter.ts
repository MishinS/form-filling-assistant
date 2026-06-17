import type { ExtractionModel, LlmFieldResult, OnAttempt } from "./types";
import { ModelNotConfigured } from "./types";
import type { ExtractField } from "../fields";
import { FREE_MODEL_IDS, isFreeSlug, isPaidModel, PAID_LAST_RESORT } from "./catalog";
import { buildExtractionPrompt } from "./prompt";
import { raceModels, type Racer, type RaceFailure } from "./race";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Per-wave таймауты. Free-волна гоняется конкурентно, поэтому её стена ограничена
// ОДНИМ таймаутом (а не суммой последовательных). Платный хвост — отдельная волна
// после провала free. Худшее: 30с (free) + 12с (paid) = 42с < 60с route maxDuration.
// Экспортируются для lib/templates/scan.ts (платный таймаут переиспользуется).
export const FREE_ATTEMPT_TIMEOUT_MS = 30_000;
export const PAID_TIMEOUT_MS = 12_000;

// Терпим модели, оборачивающие JSON в ```json несмотря на response_format.
function parseFields(txt: string): LlmFieldResult[] {
  const cleaned = txt.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as { fields?: LlmFieldResult[] };
  return parsed.fields ?? [];
}

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

      const makeRacer = (model: string): Racer<LlmFieldResult[]> => ({
        model,
        run: async (signal) => {
          const res = await fetch(ENDPOINT, {
            method: "POST",
            signal,
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
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
          if (!res.ok) return { win: false, reason: `OpenRouter HTTP ${res.status} (${model})` };
          const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const txt = data?.choices?.[0]?.message?.content;
          if (!txt) return { win: false, reason: `Пустой ответ модели (${model})` };
          try {
            return { win: true, value: parseFields(txt) };
          } catch {
            return { win: false, reason: `Некорректный JSON модели (${model})` };
          }
        },
      });

      const wave = (models: string[], timeoutMs: number) =>
        raceModels(models.map(makeRacer), { timeoutMs, onAttempt });
      const paidWave = () => wave([PAID_LAST_RESORT.id], PAID_TIMEOUT_MS);

      let failures: RaceFailure[] = [];

      if (isPaidModel(modelName)) {
        // Платная как primary (опт-ин): платная одна, free-пул — fallback.
        const paid = await paidWave();
        if (paid.ok) return paid.value;
        failures = paid.failures;
        const free = await wave(Array.from(new Set(FREE_MODEL_IDS)), FREE_ATTEMPT_TIMEOUT_MS);
        if (free.ok) return free.value;
        failures = failures.concat(free.failures);
      } else if (isFreeSlug(modelName)) {
        // free / auto-router primary: гонка всего free-пула (+ выбранная модель), затем платный хвост.
        const pool = Array.from(new Set([modelName, ...FREE_MODEL_IDS]));
        const free = await wave(pool, FREE_ATTEMPT_TIMEOUT_MS);
        if (free.ok) return free.value;
        failures = free.failures;
        const paid = await paidWave();
        if (paid.ok) return paid.value;
        failures = failures.concat(paid.failures);
      } else {
        // Неизвестный слаг: пробуем его, затем платный хвост (паритет с прежним [slug, PAID]).
        const slug = await wave([modelName], FREE_ATTEMPT_TIMEOUT_MS);
        if (slug.ok) return slug.value;
        failures = slug.failures;
        const paid = await paidWave();
        if (paid.ok) return paid.value;
        failures = failures.concat(paid.failures);
      }

      const last = failures[failures.length - 1];
      throw new Error(last?.reason ?? "Нет доступных моделей OpenRouter");
    },
  };
}
