import type { ExtractField } from "@/lib/extract/fields";
import { renderHtml, type RenderResult } from "@/lib/render/html";
import { edErrorName, resolveEd, validateEd, type EdDefaults, type EdError } from "@/lib/templates/ed-custom";
import type { TemplateLayers } from "@/lib/db/mappings";
import { ED_TEMPLATE_ID } from "@/lib/render/ed";

/** Логика редактора «Паспорта»: черновик из трёх слоёв (null — «как в
 *  репозитории»), предпросмотр и сообщения об ошибках. Компонент только рисует. */

export type Draft = TemplateLayers;
export type Layer = keyof Draft;
export const EMPTY_DRAFT: Draft = { fields: null, instruction: null, skeleton: null };

export type Action =
  | { type: "field"; id: string; patch: Partial<ExtractField> }
  | { type: "addField" }
  | { type: "deleteField"; id: string }
  | { type: "instruction"; value: string }
  | { type: "skeleton"; value: string }
  | { type: "resetLayer"; layer: Layer }
  | { type: "load"; draft: Draft };

/** Свои поля — `u1`, `u2`…: префикс не совпадёт с каталожным `e…`, и разметка
 *  каталога к пользовательскому полю не прилипнет. */
export function nextUserId(fields: ExtractField[]): string {
  const ids = new Set(fields.map(f => f.id));
  let n = 1;
  while (ids.has(`u${n}`)) n++;
  return `u${n}`;
}

export function reduce(d: Draft, a: Action, defaults: EdDefaults, newLabel: { ru: string; en: string }): Draft {
  const fields = d.fields ?? defaults.fields;
  switch (a.type) {
    case "field":
      return { ...d, fields: fields.map(f => (f.id === a.id ? { ...f, ...a.patch } : f)) };
    case "addField": {
      const id = nextUserId(fields);
      const f: ExtractField = { id, group: "terms", cell: id, label_ru: newLabel.ru, label_en: newLabel.en,
        kind: "text", required: false, strategy: "llm", slotMode: "text" };
      return { ...d, fields: [...fields, f] };
    }
    case "deleteField":
      return { ...d, fields: fields.filter(f => f.id !== a.id) };
    case "instruction":
      return { ...d, instruction: a.value };
    case "skeleton":
      return { ...d, skeleton: a.value };
    case "resetLayer":
      return { ...d, [a.layer]: null };
    case "load":
      return a.draft;
  }
}

/** Значение поля в предпросмотре — его подпись в скобках. */
export function placeholders(fields: ExtractField[]): Array<{ fieldId: string; value: string }> {
  return fields.map(f => ({ fieldId: f.id, value: `[${f.label_ru}]` }));
}

export type PreviewResult = RenderResult | { ok: false; error: EdError };

export function previewHtml(d: Draft, defaults: EdDefaults): PreviewResult {
  const eff = resolveEd(d, defaults);
  const checked = validateEd(eff);
  if (!checked.ok) return checked;
  // Константы в предпросмотре — сами собой, как в документе.
  const vals = placeholders(eff.fields.filter(f => f.fillMode !== "constant"));
  return renderHtml(eff.skeleton, eff.fields, vals);
}

export const slotToken = (name: string) => `<!--slot:${name}-->`;

export function insertAt(text: string, offset: number, token: string): { text: string; cursor: number } {
  const at = Math.max(0, Math.min(offset, text.length));
  return { text: text.slice(0, at) + token + text.slice(at), cursor: at + token.length };
}

export function errorKey(e: EdError): { key: string; name: string } {
  return { key: `ed_err_${e.code}`, name: edErrorName(e) ?? "" };
}

export function saveBody(d: Draft) {
  return { templateId: ED_TEMPLATE_ID, fields: d.fields, instruction: d.instruction, skeleton: d.skeleton };
}
