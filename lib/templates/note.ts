export const MAX_NOTE_LENGTH = 2000;

/** Заметка пользователя к прогону. Отказ, а не обрезка: молча укоротить чужой
 *  текст — значит отправить модели не то, что человек написал. */
export function parseUserNote(v: unknown): { ok: true; note: string } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, note: "" };
  if (typeof v !== "string") return { ok: false };
  if (v.length > MAX_NOTE_LENGTH) return { ok: false };
  return { ok: true, note: v.trim() };
}

/** Инструкция шаблона от пользователя. Встроенная — около 600 символов. */
export const MAX_INSTRUCTION_LENGTH = 4000;
