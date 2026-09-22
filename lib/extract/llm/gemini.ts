import type { ExtractionModel, LlmFieldResult, OnAttempt, PromptContext } from "./types";
import { ModelNotConfigured } from "./types";
import type { ExtractField } from "../fields";
import { buildExtractionPrompt } from "./prompt";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiModel(modelName: string): ExtractionModel {
  return {
    id: modelName,
    async extract(fields: ExtractField[], text: string, onAttempt?: OnAttempt, ctx?: PromptContext): Promise<LlmFieldResult[]> {
      onAttempt?.({ phase: "start", model: modelName, index: 1, total: 1 });
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new ModelNotConfigured(modelName);

      const prompt = buildExtractionPrompt({ fields, text, ...ctx });

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

      // Key goes in the header, never the query string — a URL-borne key leaks
      // into proxy, CDN, and server access logs.
      const res = await fetch(`${ENDPOINT}/${modelName}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
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
