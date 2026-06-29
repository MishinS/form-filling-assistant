import type { ExtractionModel, LlmFieldResult, OnAttempt } from "./types";
import type { ExtractField } from "../fields";
import { buildExtractionPrompt } from "./prompt";

export const STANDALONE_TIMEOUT_MS = 30_000;

export type ProbeCode =
  | "auth" | "model_not_found" | "rate_limited"
  | "unreachable" | "bad_response" | "bad_endpoint" | "provider_error";

export class LlmRequestError extends Error {
  code: ProbeCode;
  constructor(code: ProbeCode, message: string) { super(message); this.name = "LlmRequestError"; this.code = code; }
}

export function classifyStatus(status: number): ProbeCode {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

export interface CompatConfig { baseUrl: string; apiKey: string; modelSlug: string; }

/** Single OpenAI-compatible chat call. Throws LlmRequestError. Returns assistant text. */
export async function chatComplete(cfg: CompatConfig, prompt: string, signal?: AbortSignal): Promise<string> {
  const endpoint = cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const effectiveSignal = signal ?? AbortSignal.timeout(STANDALONE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST", signal: effectiveSignal,
      // SSRF: refuse to follow redirects — a validated https host could 3xx to an
      // internal/metadata address, bypassing the base-URL guard. A redirect → throw → "unreachable".
      redirect: "error",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://form-filling-assistant.local",
        "X-Title": "Form-Filling Assistant",
      },
      body: JSON.stringify({
        model: cfg.modelSlug,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new LlmRequestError("unreachable", "Провайдер недоступен");
  }
  if (!res.ok) throw new LlmRequestError(classifyStatus(res.status), `HTTP ${res.status}`);
  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const txt = data?.choices?.[0]?.message?.content;
  if (!txt) throw new LlmRequestError("bad_response", "Пустой ответ модели");
  return txt;
}

export const JSON_INSTRUCTION =
  'Ответь СТРОГО валидным JSON вида {"fields":[{"fieldId":"f1","value":"...","confidence":"high|med|low","sourceHint":"..."}]} без markdown и пояснений.';

export function parseFields(txt: string): LlmFieldResult[] {
  const cleaned = txt.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as { fields?: LlmFieldResult[] };
  return parsed.fields ?? [];
}

/** Standalone model — the user's key, single call, no race / no fallback. */
export function openaiCompatModel(cfg: CompatConfig): ExtractionModel {
  return {
    id: cfg.modelSlug,
    async extract(fields: ExtractField[], text: string, onAttempt?: OnAttempt): Promise<LlmFieldResult[]> {
      const prompt = buildExtractionPrompt(fields, text, JSON_INSTRUCTION);
      onAttempt?.({ phase: "start", model: cfg.modelSlug, total: 1 });
      const txt = await chatComplete(cfg, prompt);
      let out: LlmFieldResult[];
      try { out = parseFields(txt); }
      catch { throw new LlmRequestError("bad_response", "Некорректный JSON модели"); }
      onAttempt?.({ phase: "win", model: cfg.modelSlug });
      return out;
    },
  };
}
