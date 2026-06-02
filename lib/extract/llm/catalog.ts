// Single source of truth for the curated free-model set: drives both the sidebar
// picker (ModelSelect) and the adapter fallback chain (openrouter.ts). Slugs rotate
// on OpenRouter's free pool — refresh against https://openrouter.ai/models?max_price=0
// when extraction stops working, keeping this list and the picker in sync for free.
export const FREE_MODELS: { id: string; name: string; provider: string }[] = [
  { id: "moonshotai/kimi-k2.6:free",              name: "Kimi K2",        provider: "Moonshot AI" },
  { id: "qwen/qwen3-next-80b-a3b-instruct:free",  name: "Qwen3 Next 80B", provider: "Alibaba" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B",  provider: "Meta" },
  { id: "openai/gpt-oss-120b:free",               name: "GPT-OSS 120B",   provider: "OpenAI" },
  { id: "z-ai/glm-4.5-air:free",                  name: "GLM 4.5 Air",    provider: "Z.ai" },
];

export const FREE_MODEL_IDS = FREE_MODELS.map((m) => m.id);

export const DEFAULT_MODEL = FREE_MODELS[0].id;
