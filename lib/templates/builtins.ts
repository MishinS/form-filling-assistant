import type { ExtractField } from "@/lib/extract/fields";
import { PT_FIELDS, PT_INSTRUCTION } from "@/lib/extract/fields";
import { ED_FIELDS, ED_INSTRUCTION, ED_TEMPLATE_ID } from "@/lib/render/ed";

export interface BuiltinTemplate {
  instruction: string;
  fields: ExtractField[];
  /** true — каталог берётся только из репозитория: у шаблона нет редактора карты
   *  полей, а режимы рендера решают, сколько разметки может дать значение. */
  fieldsLocked: boolean;
}

/** Правила встроенных шаблонов. Живут в общем модуле без node-импортов, потому
 *  что нужны и роуту, и мастеру: настольный и пакетный пути собирают промт у себя,
 *  и без этого локальная модель не узнала бы, какой документ заполняет. */
const BUILTINS: Record<string, BuiltinTemplate> = {
  pt: { instruction: PT_INSTRUCTION, fields: PT_FIELDS, fieldsLocked: false },
  [ED_TEMPLATE_ID]: { instruction: ED_INSTRUCTION, fields: ED_FIELDS, fieldsLocked: true },
};

/** Поиск строго по собственным ключам: `templateId: "constructor"` не должен
 *  притвориться встроенным шаблоном и пронести запрос мимо разбора полей. */
export function builtinTemplate(templateId: unknown): BuiltinTemplate | undefined {
  if (typeof templateId !== "string") return undefined;
  return Object.hasOwn(BUILTINS, templateId) ? BUILTINS[templateId] : undefined;
}

/** Инструкция встроенного шаблона для путей, которые собирают промт сами. */
export function builtinInstruction(templateId: unknown): string | undefined {
  return builtinTemplate(templateId)?.instruction;
}
