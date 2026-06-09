import type { ExtractField } from "../fields";
import { OWN_COMPANY } from "../own-company";

/**
 * Build the LLM extraction prompt shared by all adapters. Pass `jsonFormatLine`
 * for adapters without a structured-output schema (OpenRouter); omit it for
 * adapters that enforce JSON via the API (Gemini responseSchema).
 */
export function buildExtractionPrompt(
  fields: ExtractField[],
  text: string,
  jsonFormatLine?: string,
): string {
  const specs = fields.map((f) => `- ${f.id}: ${f.label_ru} (${f.kind})`).join("\n");
  const lines = [
    "Извлеки значения полей для российского «Платёжного требования» из текста документа ниже.",
    "Верни значение для каждого поля. Если значение не найдено — пустая строка и confidence \"low\".",
    `Документ оформлен между нами (${OWN_COMPANY.name}, ИНН ${OWN_COMPANY.inn}) и контрагентом. ` +
      'В поле "Контрагент" верни ВТОРУЮ сторону (поставщика/исполнителя), НЕ нашу компанию.',
  ];
  if (jsonFormatLine) lines.push(jsonFormatLine);
  lines.push(`Поля:\n${specs}`);
  lines.push(`Текст документа:\n${text.slice(0, 12000)}`);
  return lines.join("\n\n");
}
