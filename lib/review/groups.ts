import type { ExtractField } from "@/lib/extract/fields";
import { PT_GROUPS } from "@/lib/extract/fields";
import { ED_GROUPS } from "@/lib/render/ed";

export interface FieldGroup { id: string; ru: string; en: string }

/** Подписи групп всех встроенных шаблонов. Пользовательский шаблон, чья группа
 *  сюда не попала, получает подпись из своего же идентификатора. */
const LABELS: FieldGroup[] = [...PT_GROUPS, ...ED_GROUPS];

/** Группы, которые реально есть у этих полей, в порядке появления. Шаг проверки
 *  строится по ним, а не по каталогу одного шаблона: иначе поля другого шаблона
 *  не отрисовались бы вовсе. */
export function groupsOf(fields: ExtractField[]): FieldGroup[] {
  const seen = new Set<string>();
  const out: FieldGroup[] = [];
  for (const f of fields) {
    if (seen.has(f.group)) continue;
    seen.add(f.group);
    out.push(LABELS.find((g) => g.id === f.group) ?? { id: f.group, ru: f.group, en: f.group });
  }
  return out;
}
