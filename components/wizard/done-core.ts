import type { ExtractedValue } from "@/lib/types";
import { ED_TEMPLATE_ID } from "@/lib/render/ed";

/** Чем заканчивается прогон: файлом книги или текстом документа для вставки. */
export type OutputKind = "workbook" | "html";

const HTML_TEMPLATES = new Set<string>([ED_TEMPLATE_ID]);

export function outputKindOf(templateId: string): OutputKind {
  return HTML_TEMPLATES.has(templateId) ? "html" : "workbook";
}

const SAFE = /[\/\\:*?"<>|]+/g;

/** Имя файла книги ПТ: номер контрагента из f1, если он есть. */
export function workbookName(values: ExtractedValue[]): string {
  const counter = values.find((v) => v.fieldId === "f1")?.value?.trim();
  return `ПТ_${counter ? counter.replace(SAFE, "") + "_" : ""}Ф15.xlsx`;
}
