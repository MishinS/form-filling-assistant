// Single source of truth for the curated free-model set: drives both the sidebar
// picker (ModelSelect) and the adapter fallback chain (openrouter.ts). Slugs rotate
// on OpenRouter's free pool — refresh against https://openrouter.ai/models?max_price=0
// when extraction stops working, keeping this list and the picker in sync for free.
// Refreshed 2026-06-11: kimi-k2.6/glm-4.5-air left the free pool (404 «paid only»);
// poolside/laguna rejected: hung 160s on the probe — a sequential chain can't afford it.
// nemotron-3-ultra removed same day, same criterion: probed 2.1s once, then hung >60s
// twice (locally and on prod), starving the whole fallback chain of its time budget.
export const FREE_MODELS: { id: string; name: string; provider: string }[] = [
  { id: "openai/gpt-oss-120b:free",                  name: "GPT-OSS 120B",          provider: "OpenAI" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free",    name: "Nemotron 3 Super 120B", provider: "NVIDIA" },
  { id: "qwen/qwen3-next-80b-a3b-instruct:free",     name: "Qwen3 Next 80B",        provider: "Alibaba" },
  { id: "meta-llama/llama-3.3-70b-instruct:free",    name: "Llama 3.3 70B",         provider: "Meta" },
];

export const FREE_MODEL_IDS = FREE_MODELS.map((m) => m.id);

export const DEFAULT_MODEL = FREE_MODELS[0].id;
