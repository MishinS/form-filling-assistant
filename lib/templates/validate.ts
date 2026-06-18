// Validate an untrusted field list arriving in an API body. Returns a normalized
// ExtractField[] or null (caller then falls back to the built-in PT_FIELDS).
import type { ExtractField, Strategy, FillMode, DateRule } from "@/lib/extract/fields";
import type { FieldKind } from "@/lib/types";
import { RULES } from "@/lib/extract/rules";
import { validateCellRef } from "./cellref";

const KINDS: FieldKind[] = ["string", "amount", "date", "text"];
const STRATEGIES: Strategy[] = ["rule", "llm", "manual"];
const GROUPS = ["req", "pay", "terms"];
const FILL_MODES: FillMode[] = ["auto", "constant", "date"];
const DATE_OFFSETS = ["today", "nextDay", "nextMonthSameDay", "firstOfNextMonth"];
const DATE_FORMATS = ["dmy", "monthYear"];

function parseDateRule(v: unknown): DateRule | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (typeof r.offset !== "string" || !DATE_OFFSETS.includes(r.offset)) return null;
  if (typeof r.format !== "string" || !DATE_FORMATS.includes(r.format)) return null;
  return { offset: r.offset as DateRule["offset"], format: r.format as DateRule["format"] };
}

export function parseFieldList(input: unknown, allowedSheets?: string[]): ExtractField[] | null {
  if (input == null || !Array.isArray(input) || input.length === 0) return null;
  const out: ExtractField[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const f = raw as Record<string, unknown>;
    if (typeof f.id !== "string" || !f.id) return null;
    if (typeof f.label_ru !== "string" || typeof f.label_en !== "string") return null;
    if (typeof f.kind !== "string" || !KINDS.includes(f.kind as FieldKind)) return null;
    if (typeof f.strategy !== "string" || !STRATEGIES.includes(f.strategy as Strategy)) return null;
    if (typeof f.group !== "string" || !GROUPS.includes(f.group)) return null;
    const cell = validateCellRef(typeof f.cell === "string" ? f.cell : "", allowedSheets);
    if (!cell.ok) return null;
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
      cell: cell.normalized,
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
    });
  }
  return out;
}
