import type { ExtractionModel } from "./types";
import { ModelNotConfigured } from "./types";
import { geminiModel } from "./gemini";

export function getModel(modelId: string): ExtractionModel {
  if (modelId.startsWith("gemini")) return geminiModel(modelId);
  // Groq / OpenRouter are not wired yet — graceful degradation handles this.
  throw new ModelNotConfigured(modelId);
}
