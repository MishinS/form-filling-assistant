import type { Confidence } from "@/lib/types";
import type { ExtractField } from "../fields";

export interface LlmFieldResult {
  fieldId: string;
  value: string;
  confidence: Confidence;
  sourceHint?: string;
}

/** Progress event emitted as adapters race their model candidates. */
export interface AttemptEvent {
  phase: "start" | "fail" | "win";
  model: string;
  total?: number;   // размер текущей волны гонки (start-события)
  reason?: string;  // причина провала (fail-события)
  index?: number;   // deprecated: при гонке не выставляется, оставлено для совместимости типов
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
