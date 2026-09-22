import { MAX_NOTE_LENGTH } from "@/lib/templates/note";

export const NOTE_LIMIT = MAX_NOTE_LENGTH;

export interface NoteState {
  /** Что уйдёт в запрос: пустая строка означает «раздела в промте не будет». */
  value: string;
  left: number;
  tooLong: boolean;
}

/** Состояние поля заметки. Длину не режем: обрезать чужой текст молча — значит
 *  отправить модели не то, что человек написал; показываем перебор и не даём идти. */
export function noteState(raw: string): NoteState {
  const value = raw.trim();
  return { value, left: NOTE_LIMIT - raw.length, tooLong: raw.length > NOTE_LIMIT };
}
