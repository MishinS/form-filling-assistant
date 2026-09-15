// Validate an untrusted field list arriving in an API body. Returns a normalized
// ExtractField[] or null (caller then falls back to the built-in PT_FIELDS).
import type { ExtractField, Strategy, FillMode, DateRule, FieldOption } from "@/lib/extract/fields";
import type { SlotMode } from "@/lib/render/html";
import type { FieldKind } from "@/lib/types";
import { RULES } from "@/lib/extract/rules";
import { validateCellRef } from "./cellref";
import { validateSlotRef } from "./slotref";
import type { ExtractedValue } from "@/lib/types";

const KINDS: FieldKind[] = ["string", "amount", "date", "text"];
const STRATEGIES: Strategy[] = ["rule", "llm", "manual"];
const GROUPS = ["req", "pay", "terms"];

export interface FieldListOptions {
  /** Определяет, чем проверяется адрес поля: ячейкой книги или слотом разметки. */
  format?: "xlsx" | "docx" | "html";
  allowedSheets?: string[];
  /** Слоты, объявленные разметкой html-шаблона. */
  allowedSlots?: string[];
  /** Группы полей этого шаблона; по умолчанию — группы ПТ. */
  allowedGroups?: string[];
}

export const MAX_NOTE_LENGTH = 2000;

/** Заметка пользователя к прогону. Отказ, а не обрезка: молча укоротить чужой
 *  текст — значит отправить модели не то, что человек написал. */
export function parseUserNote(v: unknown): { ok: true; note: string } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, note: "" };
  if (typeof v !== "string") return { ok: false };
  if (v.length > MAX_NOTE_LENGTH) return { ok: false };
  return { ok: true, note: v.trim() };
}

/** Поле-выбор принимает только значение из своего списка. Пустое допустимо —
 *  человек ещё не выбрал. */
export function validateChoiceValues(
  fields: ExtractField[],
  values: Array<Pick<ExtractedValue, "fieldId" | "value">>,
): boolean {
  const byId = new Map(fields.filter((f) => f.options?.length).map((f) => [f.id, f.options!]));
  for (const v of values) {
    const options = byId.get(v.fieldId);
    if (!options) continue;
    const value = (v.value ?? "").trim();
    if (value === "") continue;
    if (!options.some((o) => o.value === value)) return false;
  }
  return true;
}
const FILL_MODES: FillMode[] = ["auto", "constant", "date"];
const DATE_OFFSETS = ["today", "nextDay", "nextMonthSameDay", "firstOfNextMonth"];
const DATE_FORMATS = ["dmy", "monthYear"];

const SLOT_MODES: SlotMode[] = ["text", "breaks", "paragraphs", "contact", "list"];

function parseOptions(v: unknown): FieldOption[] | undefined {
  if (!Array.isArray(v) || v.length === 0 || v.length > 50) return undefined;
  const out: FieldOption[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") return undefined;
    const o = raw as Record<string, unknown>;
    if (typeof o.value !== "string" || !o.value || o.value.length > 200) return undefined;
    if (typeof o.label_ru !== "string" || typeof o.label_en !== "string") return undefined;
    out.push({ value: o.value, label_ru: o.label_ru, label_en: o.label_en });
  }
  return out;
}

function parseDateRule(v: unknown): DateRule | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (typeof r.offset !== "string" || !DATE_OFFSETS.includes(r.offset)) return null;
  if (typeof r.format !== "string" || !DATE_FORMATS.includes(r.format)) return null;
  return { offset: r.offset as DateRule["offset"], format: r.format as DateRule["format"] };
}

export function parseFieldList(input: unknown, opts?: FieldListOptions): ExtractField[] | null {
  const groups = opts?.allowedGroups?.length ? opts.allowedGroups : GROUPS;
  const isHtml = opts?.format === "html";
  if (input == null || !Array.isArray(input) || input.length === 0) return null;
  const out: ExtractField[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const f = raw as Record<string, unknown>;
    if (typeof f.id !== "string" || !f.id) return null;
    if (typeof f.label_ru !== "string" || typeof f.label_en !== "string") return null;
    if (typeof f.kind !== "string" || !KINDS.includes(f.kind as FieldKind)) return null;
    if (typeof f.strategy !== "string" || !STRATEGIES.includes(f.strategy as Strategy)) return null;
    if (typeof f.group !== "string" || !groups.includes(f.group)) return null;
    // An empty cell means "unmapped" — allowed, kept as "" (fill skips empty-cell
    // fields). A NON-empty but malformed cell still rejects the whole list.
    const cellRaw = typeof f.cell === "string" ? f.cell : "";
    let cellNorm = "";
    if (cellRaw.trim()) {
      const cell = isHtml
        ? validateSlotRef(cellRaw, opts?.allowedSlots ?? [])
        : validateCellRef(cellRaw, opts?.allowedSheets);
      if (!cell.ok) return null;
      cellNorm = cell.normalized;
    }
    // A `rule` (when present) must be a known RuleKey — an unknown key would make
    // RULES[rule] undefined and crash the regex pass in extractFields.
    if (f.rule !== undefined && (typeof f.rule !== "string" || !(f.rule in RULES))) return null;
    const fillMode: FillMode | undefined =
      typeof f.fillMode === "string" && FILL_MODES.includes(f.fillMode as FillMode) && f.fillMode !== "auto"
        ? (f.fillMode as FillMode) : undefined;
    const constantValue =
      fillMode === "constant" && typeof f.constantValue === "string" && f.constantValue.length <= 500
        ? f.constantValue : undefined;
    const dateRule = fillMode === "date" ? parseDateRule(f.dateRule) : undefined;
    // fillMode:date обязан нести валидный dateRule — иначе молчаливый no-write.
    if (fillMode === "date" && !dateRule) return null;
    out.push({
      id: f.id,
      group: f.group as ExtractField["group"],
      label_ru: f.label_ru,
      label_en: f.label_en,
      cell: cellNorm,
      kind: f.kind as FieldKind,
      required: f.required === true,
      strategy: f.strategy as Strategy,
      rule: typeof f.rule === "string" ? (f.rule as ExtractField["rule"]) : undefined,
      unit: typeof f.unit === "string" ? f.unit : undefined,
      area: f.area === true ? true : undefined,
      isCounterparty: f.isCounterparty === true ? true : undefined,
      // Подсказка LLM — косметика промпта: длинную (защита от раздувания промпта
      // из недоверенного тела) молча отбрасываем, поле остаётся валидным.
      hint_ru: typeof f.hint_ru === "string" && f.hint_ru.length > 0 && f.hint_ru.length <= 200
        ? f.hint_ru : undefined,
      fillMode,
      constantValue,
      dateRule: dateRule ?? undefined,
      // `slotMode` — закрытый набор, его пустить можно. `paragraphHtml` и
      // `listSeparator` попадают в вывод сырой разметкой, поэтому их задаёт
      // только каталог в репозитории: из тела запроса они не переносятся.
      slotMode: isHtml && typeof f.slotMode === "string" && SLOT_MODES.includes(f.slotMode as SlotMode)
        ? (f.slotMode as SlotMode) : undefined,
      fromNote: f.fromNote === true ? true : undefined,
      defaultValue: typeof f.defaultValue === "string" && f.defaultValue.length <= 500
        ? f.defaultValue : undefined,
      options: parseOptions(f.options),
    });
  }
  return out;
}
