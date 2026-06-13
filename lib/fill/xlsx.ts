import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import type { ExtractedValue } from "@/lib/types";
import { PT_FIELDS, type ExtractField } from "@/lib/extract/fields";
import { planWrites, sheetFile, scheduleFromValues, type CellWrite } from "./values";
import { writeCell, setFormulaCache } from "./cell";
import { sheetsFromFiles } from "@/lib/templates/xlsx-scan";
import { parseAmount, parseDateSerial } from "./parse";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Build a cell XML string (no existing cell needed). */
function buildCell(ref: string, mode: "string" | "number", value: string | number): string {
  return mode === "string"
    ? `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(String(value))}</t></is></c>`
    : `<c r="${ref}"><v>${value}</v></c>`;
}

/** Row number from a cell ref like "B2" → 2. */
function rowOf(ref: string): number {
  return parseInt(ref.replace(/^[A-Z]+/, ""), 10);
}

/** Clone-of-row-5 skeleton for an inserted schedule row (styles from the образец). */
const scheduleRowXml = (r: number) =>
  `<row r="${r}" ht="20" customHeight="1" s="38">` +
  `<c r="A${r}" s="83" t="n"></c><c r="B${r}" s="84" t="n"></c>` +
  `<c r="C${r}" s="85" t="n"></c><c r="D${r}" s="86" t="n"></c>` +
  `<c r="E${r}" s="100" t="n"></c><c r="F${r}" s="99" t="n"></c></row>`;

/**
 * Insert k−1 schedule rows after row 5 of «График оплат» (sheet3 of the ПТ
 * образец): renumber rows ≥6 and their cell refs, shift merge ranges and the
 * dimension, extend the Итого SUM range. No-op for k ≤ 1. ПТ-template-specific
 * (knows the образец layout); cells are written afterwards by writeCell.
 */
export function insertScheduleRows(xml: string, k: number): string {
  const extra = k - 1;
  if (extra <= 0) return xml;
  // 1. Renumber rows ≥6 and the cell refs inside them.
  xml = xml.replace(/(<row[^>]*\br=")(\d+)(")/g, (m, a, n, b) =>
    Number(n) >= 6 ? `${a}${Number(n) + extra}${b}` : m);
  xml = xml.replace(/(<c[^>]*\br=")([A-Z]+)(\d+)(")/g, (m, a, col, n, b) =>
    Number(n) >= 6 ? `${a}${col}${Number(n) + extra}${b}` : m);
  // 2. Shift merge ranges fully below the insertion point (A1:E1 starts at row 1 → untouched).
  xml = xml.replace(/(<mergeCell ref=")([A-Z]+)(\d+)(:)([A-Z]+)(\d+)(")/g,
    (m, a, c1, n1, colon, c2, n2, b) => {
      const s = Number(n1) >= 6 ? Number(n1) + extra : Number(n1);
      const e = Number(n2) >= 6 ? Number(n2) + extra : Number(n2);
      return `${a}${c1}${s}${colon}${c2}${e}${b}`;
    });
  // 3. Grow the dimension by the inserted rows.
  xml = xml.replace(/(<dimension ref="A1:[A-Z]+)(\d+)(")/, (_m, a, n, b) =>
    `${a}${Number(n) + extra}${b}`);
  // 4. Extend the Итого SUM over the new data rows.
  xml = xml.replace("SUM(D5:D5)", `SUM(D5:D${5 + extra})`);
  // 5. Insert the new rows right after row 5 (rows below are already renumbered).
  const row5End = xml.indexOf("</row>", xml.indexOf('<row r="5"')) + "</row>".length;
  const inserted = Array.from({ length: extra }, (_, i) => scheduleRowXml(6 + i)).join("");
  return xml.slice(0, row5End) + inserted + xml.slice(row5End);
}

/**
 * Repoint ПТ!D13 ('График оплат'!D6 = Итого) at the Итого row shifted by the
 * inserted schedule rows. Matched via the D13 cell, not the sheet name — the
 * образец stores Cyrillic in formulas as numeric XML entities. D15 (!D5, аванс)
 * is never touched. No-op for k ≤ 1.
 */
export function retargetItogoFormula(xml: string, k: number): string {
  if (k <= 1) return xml;
  return xml.replace(/(<c r="D13"[^>]*><f>[^<]*!)D6(<\/f>)/, (_m, a, b) => `${a}D${5 + k}${b}`);
}

/**
 * Write a cell into worksheet XML, inserting the cell (and row if needed)
 * when it does not already exist. For custom templates where cells may be blank.
 * INVARIANT: `ref` must be pre-validated (validateCellRef: A–Z cols + digits only) —
 * it is interpolated into a RegExp unescaped, and valid worksheet XML is assumed
 * to contain exactly one </sheetData> (guaranteed for files that passed workbookSheets).
 */
function writeCellCustom(xml: string, ref: string, mode: "string" | "number", value: string | number): string {
  const cellXml = buildCell(ref, mode, value);
  const cellRe = new RegExp(`<c r="${ref}"((?:\\s[^>]*?)?)(?:/>|>[\\s\\S]*?</c>)`);
  // Cell already exists → replace it
  if (cellRe.test(xml)) {
    return xml.replace(cellRe, () => cellXml);
  }
  // Cell's row exists → insert cell inside the row (at the end, before </row>)
  const rowNum = rowOf(ref);
  const rowRe = new RegExp(`(<row[^>]*\\br="${rowNum}"[^>]*>)([\\s\\S]*?)(</row>)`);
  const rowM = xml.match(rowRe);
  if (rowM) {
    return xml.replace(rowRe, () => `${rowM[1]}${rowM[2]}${cellXml}${rowM[3]}`);
  }
  // Neither cell nor row exists → insert a new row before </sheetData>
  const newRow = `<row r="${rowNum}">${cellXml}</row>`;
  return xml.replace("</sheetData>", () => `${newRow}</sheetData>`);
}

/** Fill an arbitrary user XLSX template: write each valued field into its
 *  "Лист!Ref" cell. No ПТ schedule/formula logic. Unknown sheets are skipped
 *  (a stale mapping must not 500 the export). Pure & sync. */
export function fillCustomXlsx(
  templateBytes: Uint8Array,
  values: ExtractedValue[],
  fields: ExtractField[],
): Uint8Array {
  const files = unzipSync(templateBytes);
  const fileBySheet = new Map(sheetsFromFiles(files).map(s => [s.name, s.file]));
  const val = (id: string) => values.find(v => v.fieldId === id)?.value?.trim() ?? "";

  for (const f of fields) {
    const raw = val(f.id);
    if (!raw) continue;
    const [sheet, ref] = f.cell.split("!");
    const file = sheet ? fileBySheet.get(sheet) : undefined;
    if (!file || !files[file] || !ref) continue;
    let xml = strFromU8(files[file]);
    if (f.kind === "amount") {
      const n = parseAmount(raw);
      xml = n !== null ? writeCellCustom(xml, ref, "number", n) : writeCellCustom(xml, ref, "string", raw);
    } else if (f.kind === "date") {
      const n = parseDateSerial(raw);
      xml = n !== null ? writeCellCustom(xml, ref, "number", n) : writeCellCustom(xml, ref, "string", raw);
    } else {
      xml = writeCellCustom(xml, ref, "string", raw);
    }
    files[file] = strToU8(xml);
  }
  return zipSync(files);
}

/** Fill the ПТ образец with the given values, preserving everything else. Pure & sync. */
export function fillPtXlsx(templateBytes: Uint8Array, values: ExtractedValue[], fields: ExtractField[] = PT_FIELDS): Uint8Array {
  const files = unzipSync(templateBytes);

  // Multi-row schedule → structural pass first (insert rows / retarget Итого formula).
  const schedule = scheduleFromValues(values);
  const k = schedule?.length ?? 1;
  if (k > 1) {
    const grafFile = sheetFile("График оплат");
    files[grafFile] = strToU8(insertScheduleRows(strFromU8(files[grafFile]), k));
    const ptFile = sheetFile("ПТ");
    files[ptFile] = strToU8(retargetItogoFormula(strFromU8(files[ptFile]), k));
  }

  const byFile = new Map<string, CellWrite[]>();
  for (const w of planWrites(values, fields, schedule)) {
    const file = sheetFile(w.sheet);
    const arr = byFile.get(file) ?? [];
    arr.push(w);
    byFile.set(file, arr);
  }

  for (const [file, ws] of Array.from(byFile)) {
    const entry = files[file];
    if (!entry) throw new Error(`Template missing ${file}`);
    let xml = strFromU8(entry);
    for (const w of ws) {
      xml =
        w.mode === "formulaCache"
          ? setFormulaCache(xml, w.ref, w.value as number)
          : writeCell(xml, w.ref, w.mode, w.value);
    }
    files[file] = strToU8(xml);
  }

  return zipSync(files);
}
