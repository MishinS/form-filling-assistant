import type { ExtractionModel } from "./types";
import { ModelNotConfigured } from "./types";
import { geminiModel } from "./gemini";
import { openrouterModel } from "./openrouter";

export function getModel(modelId: string): ExtractionModel {
  if (modelId.startsWith("gemini")) return geminiModel(modelId);
  // OpenRouter slugs are namespaced, e.g. "deepseek/deepseek-chat-v3-0324:free".
  if (modelId.includes("/")) return openrouterModel(modelId);
  // Bare ids without a provider namespace are unwired — graceful degradation handles this.
  throw new ModelNotConfigured(modelId);
}
