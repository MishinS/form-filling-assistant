import { readFile } from "node:fs/promises";
import { ED_FIELDS, ED_INSTRUCTION } from "@/lib/render/ed";
import { ED_SKELETON_PATH } from "@/lib/render/ed-skeleton";
import { getTemplateLayers } from "@/lib/db/mappings";
import { STR } from "@/lib/seed/pt";
import { edErrorName, resolveEd, type EdDefaults, type EdError, type EffectiveEd } from "./ed-custom";

export { edErrorName };

/** Серверная половина пользовательского «Паспорта»: читает каркас из репозитория
 *  и слои пользователя из БД. Только для роутов — тянет node. */

export async function edDefaults(): Promise<EdDefaults> {
  return { fields: ED_FIELDS, instruction: ED_INSTRUCTION, skeleton: await readFile(ED_SKELETON_PATH, "utf8") };
}

/** Действующий шаблон: гость (email null) получает репозиторный без обращения к БД.
 *  Ошибку БД не глотаем — молча отдать шаблон по умолчанию значило бы запустить
 *  человеку не тот документ, который он настроил. */
export async function effectiveEd(email: string | null): Promise<EffectiveEd> {
  const defaults = await edDefaults();
  const layers = email ? await getTemplateLayers(email, "ed") : null;
  return resolveEd(layers, defaults);
}

/** Русское сообщение для ответа API — из того же словаря, что и у редактора. */
export function edErrorMessage(e: EdError): string {
  const s = STR[`ed_err_${e.code}`];
  return (s?.ru ?? e.code).replace("{name}", edErrorName(e) ?? "");
}
