import type { Lang } from "@/lib/seed/pt";

export type PluralForm = "one" | "few" | "many";

/**
 * Pick the plural form a count needs, so callers can compose a dictionary key
 * (`files_one` / `files_few` / `files_many`).
 *
 * Russian has three forms — «1 файл», «3 файла», «5 файлов» — and the teens are
 * the trap: 11–14 take `many` even though 1–4 do not. English has two, so `few`
 * is unreachable there and its key carries the same word as `many`.
 */
export function pluralForm(n: number, lang: Lang): PluralForm {
  const abs = Math.abs(Math.trunc(n));
  if (lang !== "ru") return abs === 1 ? "one" : "many";
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
}
