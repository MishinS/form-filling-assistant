import type { ExtractField } from "../fields";
import { OWN_COMPANY } from "../own-company";

export interface PromptInput {
  fields: ExtractField[];
  text: string;
  /** Правила шаблона. Ничто, названное одним шаблоном, не живёт в общей механике. */
  instruction?: string;
  /** Заметка пользователя к этому прогону: контекст, которого в документах нет. */
  userNote?: string;
  /** Для адаптеров без схемы структурированного ответа (OpenRouter). Опускается
   *  там, где JSON навязан самим API (Gemini responseSchema). */
  jsonFormatLine?: string;
  localGuidance?: boolean;
}

function fieldLine(f: ExtractField): string {
  const notes = [
    f.fromNote ? "из контекста пользователя, не из документов" : null,
    f.hint_ru ?? null,
  ].filter((n): n is string => Boolean(n));
  const suffix = notes.length ? ` — ${notes.join("; ")}` : "";
  return `- ${f.id}: ${f.label_ru} (${f.kind})${suffix}`;
}

/** Собирает промт извлечения из механики, общей для всех шаблонов, и двух
 *  внешних текстов: правил шаблона и заметки пользователя к прогону. Каждый из
 *  них идёт своим разделом, чтобы модель могла их различить. */
export function buildExtractionPrompt(input: PromptInput): string {
  const { fields, text, instruction, userNote, jsonFormatLine, localGuidance } = input;
  const lines: string[] = [];

  if (instruction?.trim()) lines.push(instruction.trim());
  if (userNote?.trim()) {
    lines.push(`Контекст пользователя (не из документов):\n${userNote.trim()}`);
  }

  lines.push(
    "Верни значение для каждого поля. Если значение не найдено — пустая строка и confidence \"low\".",
    "Отвечай кратко и по существу: только суть значения, без вводных слов и лишних уточнений. " +
      "Организационно-правовые формы компаний сокращай (ООО, АО, ИП и т.п.), никогда не расшифровывай.",
    `Документ оформлен между нами (${OWN_COMPANY.name}, ИНН ${OWN_COMPANY.inn}) и контрагентом. ` +
      'В поле "Контрагент" верни ВТОРУЮ сторону (поставщика/исполнителя), НЕ нашу компанию.',
  );

  if (jsonFormatLine) lines.push(jsonFormatLine);
  lines.push(`Поля:\n${fields.map(fieldLine).join("\n")}`);
  if (localGuidance) {
    lines.push(
      "Важно: верни КАЖДОЕ поле из списка по его fieldId. Если значения нет — пустая строка и confidence \"low\". " +
        "Не пропускай поля.\n" +
        'Пример формата ответа: {"fields":[{"fieldId":"f1","value":"ООО «Пример»","confidence":"high"}]}\n' +
        `Наша компания — ${OWN_COMPANY.name} (ИНН ${OWN_COMPANY.inn}); никогда не возвращай её как Контрагент.`,
    );
  }
  lines.push(`Текст документа:\n${text.slice(0, 12000)}`);
  return lines.join("\n\n");
}
