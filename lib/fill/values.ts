import { PT_FIELDS, type ExtractField } from "@/lib/extract/fields";
import type { ExtractedValue } from "@/lib/types";
import { parseAmount, parseDateSerial } from "./parse";
import { buildSchedule, formatPercent, round2, type ScheduleRow } from "./schedule";
import { applyDateRule } from "./daterule";

export type WriteMode = "string" | "number" | "formulaCache";
export interface CellWrite {
  sheet: "ПТ" | "График оплат";
  ref: string;
  mode: WriteMode;
  value: string | number;
}

const SHEET_FILE: Record<string, string> = {
  "ПТ": "xl/worksheets/sheet1.xml",
  "График оплат": "xl/worksheets/sheet3.xml",
};

export function sheetFile(name: string): string {
  const file = SHEET_FILE[name];
  if (!file) throw new Error(`Unknown sheet: ${name}`);
  return file;
}

const refOf = (cell: string) => cell.split("!")[1]; // "ПТ!D9" → "D9"

/** Build the payment schedule from the reviewed values (f4/f7 total, f10 due, f9 terms).
 *  Null when there is no parseable total → no schedule writes at all. */
export function scheduleFromValues(values: ExtractedValue[]): ScheduleRow[] | null {
  const val = (id: string) => values.find(v => v.fieldId === id)?.value?.trim() ?? "";
  const total = parseAmount(val("f4") || val("f7"));
  if (total === null) return null;
  return buildSchedule(total, parseDateSerial(val("f10")), val("f9"));
}

/** Применить режимы заполнения полей: constant/date берут значение из конфига поля
 *  (дата считается от `now`), auto — сохраняют извлечённое значение. Один
 *  ExtractedValue на поле. Вызывается в начале fill-функций перед planWrites. */
export function resolveValues(
  fields: ExtractField[],
  extracted: ExtractedValue[],
  now: Date,
): ExtractedValue[] {
  const byId = new Map(extracted.map((v) => [v.fieldId, v]));
  return fields.map((f) => {
    if (f.fillMode === "constant") {
      return { fieldId: f.id, value: f.constantValue ?? "", confidence: "high",
        source: { fileId: null, locator: "" } };
    }
    if (f.fillMode === "date" && f.dateRule) {
      return { fieldId: f.id, value: applyDateRule(f.dateRule, now), confidence: "high",
        source: { fileId: null, locator: "" } };
    }
    return byId.get(f.id) ?? { fieldId: f.id, value: "", confidence: "low",
      source: { fileId: null, locator: "" } };
  });
}

export function planWrites(
  values: ExtractedValue[],
  fields: ExtractField[] = PT_FIELDS,
  schedule?: ScheduleRow[] | null,
): CellWrite[] {
  const val = (id: string) => values.find(v => v.fieldId === id)?.value?.trim() ?? "";
  const writes: CellWrite[] = [];

  // Direct ПТ cells (amounts f4/f7 handled via the schedule below).
  for (const f of fields) {
    if (f.id === "f4" || f.id === "f7") continue;
    const raw = val(f.id);
    if (!raw) continue;
    const ref = refOf(f.cell);
    if (f.kind === "amount") {
      const n = parseAmount(raw);
      if (n !== null) writes.push({ sheet: "ПТ", ref, mode: "number", value: n });
    } else if (f.kind === "date") {
      const n = parseDateSerial(raw);
      if (n !== null) writes.push({ sheet: "ПТ", ref, mode: "number", value: n });
    } else {
      writes.push({ sheet: "ПТ", ref, mode: "string", value: raw });
    }
  }

  // «График оплат» schedule (single «Аванс 100%» row, or a %-split parsed from f9)
  // drives ПТ!D13/D15 via their formulas. `undefined` → compute here; `null` → no total.
  const rows = schedule === undefined ? scheduleFromValues(values) : schedule;
  if (rows) {
    rows.forEach((row, i) => {
      const r = 5 + i;
      if (i > 0) writes.push({ sheet: "График оплат", ref: `A${r}`, mode: "number", value: i + 1 });
      writes.push({ sheet: "График оплат", ref: `B${r}`, mode: "string", value: row.stage });
      writes.push({ sheet: "График оплат", ref: `C${r}`, mode: "string", value: formatPercent(row.percent) });
      writes.push({ sheet: "График оплат", ref: `D${r}`, mode: "number", value: row.amount });
      if (row.due !== null) writes.push({ sheet: "График оплат", ref: `E${r}`, mode: "number", value: row.due });
    });
    // При разбивке сроки пусты, но E5 образца содержит образцовую дату — затереть пустой строкой.
    if (rows.length > 1) {
      writes.push({ sheet: "График оплат", ref: "E5", mode: "string", value: "" });
    }
    const total = round2(rows.reduce((a, r) => a + r.amount, 0));
    writes.push({ sheet: "ПТ", ref: "D13", mode: "formulaCache", value: total });          // ='График оплат'!D{Итого} (=SUM)
    writes.push({ sheet: "ПТ", ref: "D15", mode: "formulaCache", value: rows[0].amount }); // ='График оплат'!D5 (аванс)
  }

  return writes;
}
