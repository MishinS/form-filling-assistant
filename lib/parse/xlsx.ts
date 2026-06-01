import ExcelJS from "exceljs";
import type { ParseResult, ParsedBlock } from "./types";

export async function parseXlsx(buf: Buffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS's ambient Buffer type ≠ Node's Buffer (Uint8Array) under strict TS — cast required.
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const blocks: ParsedBlock[] = [];
  wb.eachSheet((ws) => {
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const text = (cell.text ?? "").trim();
        if (!text) return;
        blocks.push({ text, locator: { kind: "xlsx", sheet: ws.name, cell: cell.address } });
      });
    });
  });
  return { pages: wb.worksheets.length, blocks, scannedPages: [], warnings: [] };
}
