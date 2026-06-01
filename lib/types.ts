export type TemplateFormat = "xlsx" | "docx";
export type FieldKind = "string" | "amount" | "date" | "text";
export type FieldSource = "rule" | "llm" | "manual";
export type Confidence = "high" | "med" | "low";
export type FillStatus = "uploading" | "processing" | "review" | "done" | "error";

export interface Field {
  id: string;
  group: string;
  label_ru: string;
  label_en: string;
  kind: FieldKind;
  cell: string;            // e.g. "ПТ!D9"
  required: boolean;
  source: FieldSource;
  rule?: string;
  unit?: string;
}

export interface Template {
  id: string;
  code: string;
  name_ru: string;
  name_en: string;
  desc_ru: string;
  desc_en: string;
  locale: string;
  format: TemplateFormat;
  fileKey: string | null;
  sheets: string[];
  fields: Field[];
  primary?: boolean;
}

export interface SourceFile {
  id: string;
  name: string;
  mime: string;
  size: string;
  pages: number;
  blobKey: string | null;
  scanned?: boolean;
}

export interface ExtractedValue {
  fieldId: string;
  value: string;
  confidence: Confidence;
  source: { fileId: string | null; locator: string };
}

export interface Fill {
  id: string;
  userId: string | null;
  templateId: string;
  status: FillStatus;
  sources: SourceFile[];
  values: ExtractedValue[];
  createdAt: string;
}
