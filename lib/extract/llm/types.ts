import type { Confidence } from "@/lib/types";
import type { ExtractField } from "../fields";

export interface LlmFieldResult {
  fieldId: string;
  value: string;
  confidence: Confidence;
  sourceHint?: string;
}

export interface ExtractionModel {
  id: string;
  extract(fields: ExtractField[], text: string): Promise<LlmFieldResult[]>;
}

export class ModelNotConfigured extends Error {
  constructor(modelId: string) {
    super(`Модель «${modelId}» не настроена`);
    this.name = "ModelNotConfigured";
  }
}
