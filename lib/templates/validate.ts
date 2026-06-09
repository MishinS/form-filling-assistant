// Validate an untrusted field list arriving in an API body. Returns a normalized
// ExtractField[] or null (caller then falls back to the built-in PT_FIELDS).
import type { ExtractField, Strategy } from "@/lib/extract/fields";
import type { FieldKind } from "@/lib/types";
import { RULES } from "@/lib/extract/rules";
import { validateCellRef } from "./cellref";

const KINDS: FieldKind[] = ["string", "amount", "date", "text"];
const STRATEGIES: Strategy[] = ["rule", "llm", "manual"];
const GROUPS = ["req", "pay", "terms"];

export function parseFieldList(input: unknown): ExtractField[] | null {
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
    const cell = validateCellRef(typeof f.cell === "string" ? f.cell : "");
    if (!cell.ok) return null;
    // A `rule` (when present) must be a known RuleKey — an unknown key would make
    // RULES[rule] undefined and crash the regex pass in extractFields.
    if (f.rule !== undefined && (typeof f.rule !== "string" || !(f.rule in RULES))) return null;
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
    });
  }
  return out;
}
