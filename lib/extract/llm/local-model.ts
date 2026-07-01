import type { ExtractionModel, LlmFieldResult, OnAttempt } from "./types";
import type { ExtractField } from "../fields";
import { buildExtractionPrompt } from "./prompt";
import { parseFieldsLenient, JSON_INSTRUCTION, LlmRequestError, type ProbeCode } from "./openai-compat";
import { invokeLlmChat } from "@/lib/desktop/tauri";

const CODES: ProbeCode[] = [
  "auth", "model_not_found", "rate_limited", "unreachable", "bad_response", "bad_endpoint", "provider_error",
];
function toProbeCode(msg: string): ProbeCode {
  return (CODES as string[]).includes(msg) ? (msg as ProbeCode) : "provider_error";
}

/** Local model — runs in the desktop webview via the Rust llm_chat transport.
 *  Single call, no race / no fallback (mirrors openaiCompatModel). */
export function localCompatModel(baseUrl: string, modelSlug: string): ExtractionModel {
  return {
    id: modelSlug,
    async extract(fields: ExtractField[], text: string, onAttempt?: OnAttempt): Promise<LlmFieldResult[]> {
      const prompt = buildExtractionPrompt(fields, text, JSON_INSTRUCTION, true);
      onAttempt?.({ phase: "start", model: modelSlug, total: 1 });
      let txt: string;
      try {
        txt = await invokeLlmChat({ baseUrl, model: modelSlug, prompt });
      } catch (e) {
        throw new LlmRequestError(toProbeCode(e instanceof Error ? e.message : String(e)), "Локальная модель недоступна");
      }
      // Tolerant parse: recover partial fields from a small model's near-valid JSON
      // (a dropped brace hard-fails the strict parser). Genuine garbage → 0 fields → fail.
      const out = parseFieldsLenient(txt);
      if (out.length === 0) throw new LlmRequestError("bad_response", "Некорректный JSON локальной модели");
      onAttempt?.({ phase: "win", model: modelSlug });
      return out;
    },
  };
}
