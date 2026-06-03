// Validates/normalizes a worksheet cell reference for the ПТ template editor.
// Only the ПТ sheet is writable (planWrites/sheetFile map ПТ→sheet1, График→sheet3
// via formulas); user cells are restricted to ПТ so fill never hits "Template missing".

export type CellRefResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: "empty" | "format" | "sheet" };

const REF_RE = /^(?:([^!]+)!)?([A-Z]{1,3})([1-9]\d{0,4})$/;

export function validateCellRef(input: string): CellRefResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };
  const m = raw.match(REF_RE);
  if (!m) return { ok: false, reason: "format" };
  const [, sheet, col, row] = m;
  if (sheet && sheet !== "ПТ") return { ok: false, reason: "sheet" };
  return { ok: true, normalized: `ПТ!${col}${row}` };
}
