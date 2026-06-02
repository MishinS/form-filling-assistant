import type { ExtractionModel, LlmFieldResult } from "./types";
import { ModelNotConfigured } from "./types";
import type { ExtractField } from "../fields";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiModel(modelName: string): ExtractionModel {
  return {
    id: modelName,
    async extract(fields: ExtractField[], text: string): Promise<LlmFieldResult[]> {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new ModelNotConfigured(modelName);

      const specs = fields.map((f) => `- ${f.id}: ${f.label_ru} (${f.kind})`).join("\n");
      const prompt = [
        "Извлеки значения полей для российского «Платёжного требования» из текста документа ниже.",
        "Верни значение для каждого поля. Если значение не найдено — пустая строка и confidence \"low\".",
        `Поля:\n${specs}`,
        `Текст документа:\n${text.slice(0, 12000)}`,
      ].join("\n\n");

      const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              fields: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    fieldId: { type: "STRING" },
                    value: { type: "STRING" },
                    confidence: { type: "STRING", enum: ["high", "med", "low"] },
                    sourceHint: { type: "STRING" },
                  },
                  required: ["fieldId", "value", "confidence"],
                },
              },
            },
            required: ["fields"],
          },
        },
      };

      const res = await fetch(`${ENDPOINT}/${modelName}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!txt) throw new Error("Пустой ответ модели");
      const parsed = JSON.parse(txt) as { fields?: LlmFieldResult[] };
      return parsed.fields ?? [];
    },
  };
}
