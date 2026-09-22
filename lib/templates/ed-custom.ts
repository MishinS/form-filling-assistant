import type { ExtractField } from "@/lib/extract/fields";
import { renderHtml } from "@/lib/render/html";
import { checkSubset, NAVI_SUBSET, type SubsetError } from "@/lib/render/subset";
import type { TemplateLayers } from "@/lib/db/mappings";
import { MAX_INSTRUCTION_LENGTH } from "./note";

/** Пользовательская версия «Паспорта Заказа и договора»: какой шаблон действует
 *  и годится ли он. Один модуль на редактор, сохранение, извлечение и рендер —
 *  чтобы «можно сохранить» и «можно отрисовать» не разошлись. Без node-импортов:
 *  редактор проверяет черновик у себя. */

/** Встроенный каркас — около 4 КБ; предел защищает промт и БД, а не вкус. */
export const MAX_SKELETON_LENGTH = 50_000;

export interface EdDefaults {
  fields: ExtractField[];
  instruction: string;
  skeleton: string;
}

export interface EffectiveEd extends EdDefaults {
  custom: { fields: boolean; instruction: boolean; skeleton: boolean };
}

export type EdError =
  | { code: "unknown_slot"; fieldId: string }
  | { code: "unaddressed_slot"; slot: string }
  | { code: "duplicate_slot"; slot: string }
  | { code: "duplicate_field"; fieldId: string }
  | { code: "subset"; error: SubsetError }
  | { code: "unsafe_href"; href: string }
  | { code: "instruction_too_long" }
  | { code: "skeleton_too_long" };

export type EdResult = { ok: true } | { ok: false; error: EdError };

/** Разметку в вывод вносят `paragraphHtml` и `listSeparator` — их задаёт только
 *  каталог. Поле с каталожным id получает их из каталога, своё поле — никогда. */
function withCatalogMarkup(fields: ExtractField[], catalog: ExtractField[]): ExtractField[] {
  const byId = new Map(catalog.map((f) => [f.id, f]));
  return fields.map((f) => {
    const c = byId.get(f.id);
    return { ...f, paragraphHtml: c?.paragraphHtml, listSeparator: c?.listSeparator };
  });
}

export function resolveEd(layers: TemplateLayers | null, defaults: EdDefaults): EffectiveEd {
  const fields = layers?.fields ?? null;
  const instruction = layers?.instruction ?? null;
  const skeleton = layers?.skeleton ?? null;
  return {
    fields: fields ? withCatalogMarkup(fields, defaults.fields) : defaults.fields,
    instruction: instruction ?? defaults.instruction,
    skeleton: skeleton ?? defaults.skeleton,
    custom: { fields: fields !== null, instruction: instruction !== null, skeleton: skeleton !== null },
  };
}

const HREF = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const SAFE_HREF = /^(?:https?:|mailto:|tel:|#)/i;

function unsafeHref(skeleton: string): string | null {
  HREF.lastIndex = 0;
  for (let m = HREF.exec(skeleton); m; m = HREF.exec(skeleton)) {
    const href = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!SAFE_HREF.test(href)) return href;
  }
  return null;
}

/** Имя, которое ошибка называет: слот, поле, тег, атрибут, размер или ссылка. */
export function edErrorName(e: EdError): string | undefined {
  switch (e.code) {
    case "unknown_slot": case "duplicate_field": return e.fieldId;
    case "unaddressed_slot": case "duplicate_slot": return e.slot;
    case "unsafe_href": return e.href;
    case "subset": {
      const s = e.error;
      if (s.code === "attr_not_allowed") return `${s.tag} ${s.attr}`;
      if (s.code === "font_size_not_allowed") return s.size;
      if (s.code === "unparsable") return String(s.at);
      return s.tag;
    }
    default: return undefined;
  }
}

export function validateEd(t: EdDefaults): EdResult {
  if (t.instruction.length > MAX_INSTRUCTION_LENGTH) return { ok: false, error: { code: "instruction_too_long" } };
  if (t.skeleton.length > MAX_SKELETON_LENGTH) return { ok: false, error: { code: "skeleton_too_long" } };

  const subset = checkSubset(t.skeleton, NAVI_SUBSET);
  if (!subset.ok) return { ok: false, error: { code: "subset", error: subset.error } };
  const href = unsafeHref(t.skeleton);
  if (href !== null) return { ok: false, error: { code: "unsafe_href", href } };

  const seen = new Set<string>();
  for (const f of t.fields) {
    if (seen.has(f.id)) return { ok: false, error: { code: "duplicate_field", fieldId: f.id } };
    seen.add(f.id);
  }

  // Пробный рендер без значений: он же и есть проверка соответствия слотов полям.
  const dry = renderHtml(t.skeleton, t.fields, []);
  return dry.ok ? { ok: true } : { ok: false, error: dry.error };
}
