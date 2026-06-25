/** Pure client-safe data module — NO node: imports allowed here.
 *  providers.ts imports this and re-exports so all existing imports keep working. */

export type ProviderId = "openrouter" | "openai" | "anthropic" | "google" | "custom";

export const PROVIDER_PRESETS: Record<Exclude<ProviderId, "custom">, { label: string; baseUrl: string }> = {
  openrouter: { label: "OpenRouter",    baseUrl: "https://openrouter.ai/api/v1" },
  openai:     { label: "OpenAI",        baseUrl: "https://api.openai.com/v1" },
  anthropic:  { label: "Anthropic",     baseUrl: "https://api.anthropic.com/v1" },
  google:     { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
};
