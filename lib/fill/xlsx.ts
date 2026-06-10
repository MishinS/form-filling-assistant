import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import type { ExtractedValue } from "@/lib/types";
import { PT_FIELDS, type ExtractField } from "@/lib/extract/fields";
import { planWrites, sheetFile, type CellWrite } from "./values";
import { writeCell, setFormulaCache } from "./cell";
import { workbookSheets } from "@/lib/templates/xlsx-scan";
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

/**
 * Write a cell into worksheet XML, inserting the cell (and row if needed)
 * when it does not already exist. For custom templates where cells may be blank.
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
  const fileBySheet = new Map(workbookSheets(templateBytes).map(s => [s.name, s.file]));
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

  const byFile = new Map<string, CellWrite[]>();
  for (const w of planWrites(values, fields)) {
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
