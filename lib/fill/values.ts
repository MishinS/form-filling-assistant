import { PT_FIELDS } from "@/lib/extract/fields";
import type { ExtractedValue } from "@/lib/types";
import { parseAmount, parseDateSerial } from "./parse";
import { buildSchedule } from "./schedule";

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

export function planWrites(values: ExtractedValue[]): CellWrite[] {
  const val = (id: string) => values.find(v => v.fieldId === id)?.value?.trim() ?? "";
  const writes: CellWrite[] = [];

  // Direct ПТ cells (amounts f4/f7 handled via the schedule below).
  for (const f of PT_FIELDS) {
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

  // «График оплат» schedule (default аванс 100%) drives ПТ!D13/D15 via their formulas.
  const total = parseAmount(val("f4") || val("f7"));
  if (total !== null) {
    const due = parseDateSerial(val("f10"));
    const [row] = buildSchedule(total, due);
    writes.push({ sheet: "График оплат", ref: "D5", mode: "number", value: row.amount });
    writes.push({ sheet: "График оплат", ref: "B5", mode: "string", value: row.stage });
    writes.push({ sheet: "График оплат", ref: "C5", mode: "string", value: `${row.percent}%` });
    if (row.due !== null) {
      writes.push({ sheet: "График оплат", ref: "E5", mode: "number", value: row.due });
    }
    writes.push({ sheet: "ПТ", ref: "D13", mode: "formulaCache", value: total });      // = SUM(D5:D5)
    writes.push({ sheet: "ПТ", ref: "D15", mode: "formulaCache", value: row.amount });  // = D5
  }

  return writes;
}
