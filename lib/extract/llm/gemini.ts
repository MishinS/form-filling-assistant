import type { ExtractionModel, LlmFieldResult } from "./types";
import { ModelNotConfigured } from "./types";
import type { ExtractField } from "../fields";
import { buildExtractionPrompt } from "./prompt";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiModel(modelName: string): ExtractionModel {
  return {
    id: modelName,
    async extract(fields: ExtractField[], text: string): Promise<LlmFieldResult[]> {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new ModelNotConfigured(modelName);

      const prompt = buildExtractionPrompt(fields, text);

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
