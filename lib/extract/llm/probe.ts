import { chatComplete, LlmRequestError, type ProbeCode } from "./openai-compat";
import { assertSafeBaseUrl } from "./providers";

export type ProbeResult = { ok: true } | { ok: false; code: ProbeCode };

const PROBE_PROMPT = 'Reply with the JSON object {"ok":true} and nothing else.';

/** Live validation: SSRF-check the URL, then one short chat call. Maps failures to a code. */
export async function probeModel(cfg: { baseUrl: string; apiKey: string; modelSlug: string }): Promise<ProbeResult> {
  try {
    await assertSafeBaseUrl(cfg.baseUrl);
  } catch {
    return { ok: false, code: "bad_endpoint" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    await chatComplete(cfg, PROBE_PROMPT, controller.signal);
    return { ok: true };
  } catch (e) {
    if (e instanceof LlmRequestError) return { ok: false, code: e.code };
    return { ok: false, code: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
