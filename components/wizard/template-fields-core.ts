import type { ExtractField } from "@/lib/extract/fields";
import { ED_FIELDS, ED_INSTRUCTION, ED_TEMPLATE_ID } from "@/lib/render/ed";
import { builtinInstruction } from "@/lib/templates/builtins";

/** Действующий «Паспорт» пользователя, как его отдаёт `/api/mappings?templateId=ed`. */
export interface EdConfig {
  fields: ExtractField[];
  instruction: string;
}

export interface WizardTemplate {
  fields: ExtractField[];
  /** Для путей, собирающих промт на клиенте (локальная модель). */
  instruction: string | undefined;
  needsFetch: boolean;
}

/** Какие поля и какую инструкцию мастер берёт для выбранного шаблона. Сервер решает
 *  то же самое у себя; клиенту это нужно для формы проверки и локальной модели. */
export function wizardTemplate(
  tpl: string,
  ctx: { guest: boolean; ptFields: ExtractField[]; customFields: Record<string, ExtractField[]>; edConfig: EdConfig | undefined },
): WizardTemplate {
  if (tpl === "pt") return { fields: ctx.ptFields, instruction: builtinInstruction("pt"), needsFetch: false };
  if (tpl === ED_TEMPLATE_ID) {
    if (ctx.guest) return { fields: ED_FIELDS, instruction: ED_INSTRUCTION, needsFetch: false };
    return ctx.edConfig
      ? { ...ctx.edConfig, needsFetch: false }
      : { fields: [], instruction: undefined, needsFetch: true };
  }
  const own = ctx.customFields[tpl];
  return { fields: own ?? [], instruction: undefined, needsFetch: own === undefined };
}

export function parseEdConfig(json: unknown): EdConfig | null {
  if (!json || typeof json !== "object") return null;
  const j = json as { fields?: unknown; instruction?: unknown };
  if (!Array.isArray(j.fields) || typeof j.instruction !== "string") return null;
  return { fields: j.fields as ExtractField[], instruction: j.instruction };
}
