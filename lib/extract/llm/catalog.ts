// Single source of truth for the curated free-model set: drives both the sidebar
// picker (ModelSelect) and the adapter fallback chain (openrouter.ts). Slugs rotate
// on OpenRouter's free pool — refresh against https://openrouter.ai/models?max_price=0
// when extraction stops working, keeping this list and the picker in sync for free.
// Refreshed 2026-06-11: kimi-k2.6/glm-4.5-air left the free pool (404 «paid only»);
// poolside/laguna rejected: hung 160s on the probe — a sequential chain can't afford it.
// nemotron-3-ultra removed same day, same criterion: probed 2.1s once, then hung >60s
// twice (locally and on prod), starving the whole fallback chain of its time budget.
// 2026-06-12: appended openrouter/free — OpenRouter's server-side auto-router over
// the whole free pool; the last-resort attempt when every curated model is down.
// NOTE: the router does NOT guarantee a live model — it can route to a busy one and
// pass its 429 through, or hang; treat it as a roulette last resort, never a primary.
// Refreshed 2026-06-13: qwen3-next/llama-3.3 dropped — chronic upstream 429 (their
// only free host, Venice, is permanently saturated; probed dead 06-11/12/13).
// nemotron-3-super demoted to 4th: intermittently hangs on larger prompts (30s burn).
// Added probed-stable nemotron-3-nano-30b + nex-n2-pro (0.4–1.9s, valid JSON on both
// scan and extraction prompts, respect brevity hints).
export const FREE_MODELS: { id: string; name: string; provider: string }[] = [
  { id: "openai/gpt-oss-120b:free",                  name: "GPT-OSS 120B",          provider: "OpenAI" },
  { id: "nvidia/nemotron-3-nano-30b-a3b:free",       name: "Nemotron 3 Nano 30B",   provider: "NVIDIA" },
  { id: "nex-agi/nex-n2-pro:free",                   name: "Nex N2 Pro",            provider: "Nex AGI" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free",    name: "Nemotron 3 Super 120B", provider: "NVIDIA" },
  { id: "openrouter/free",                           name: "Авто — любая свободная", provider: "OpenRouter" },
];

export const FREE_MODEL_IDS = FREE_MODELS.map((m) => m.id);

export const DEFAULT_MODEL = FREE_MODELS[0].id;

// The catalog's notion of "free": either an explicit ":free" slug or OpenRouter's
// auto-router meta-slug, which doesn't carry the suffix. Used by openrouter.ts to
// decide whether the fallback chain applies.
export function isFreeSlug(id: string): boolean {
  return id.endsWith(":free") || id === "openrouter/free";
}
