import type { Confidence } from "@/lib/types";
import type { ExtractField } from "../fields";

export interface LlmFieldResult {
  fieldId: string;
  value: string;
  confidence: Confidence;
  sourceHint?: string;
}

/** Progress event emitted by an adapter as it walks its model-candidate chain. */
export interface AttemptEvent {
  phase: "start" | "fail";
  model: string;
  index?: number; // 1-based position in the candidate chain (start events)
  total?: number; // candidate chain length (start events)
  reason?: string; // failure reason (fail events)
}

export type OnAttempt = (ev: AttemptEvent) => void;

export interface ExtractionModel {
  id: string;
  extract(fields: ExtractField[], text: string, onAttempt?: OnAttempt): Promise<LlmFieldResult[]>;
}

export class ModelNotConfigured extends Error {
  constructor(modelId: string) {
    super(`Модель «${modelId}» не настроена`);
    this.name = "ModelNotConfigured";
  }
}
