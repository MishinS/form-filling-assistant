import { PDFDocument, StandardFonts } from "pdf-lib";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, TextRun } from "docx";

// 1x1 transparent PNG.
const ONE_PX_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Two-page PDF with a real text layer. */
export async function makeTextPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([300, 300]);
  p1.drawText("Contractor Romashka LLC", { x: 20, y: 250, size: 12, font });
  const p2 = doc.addPage([300, 300]);
  p2.drawText("Amount 1000 USD", { x: 20, y: 250, size: 12, font });
  return Buffer.from(await doc.save());
}

/** Single-page image-only PDF (no text layer) — simulates a scan. */
export async function makeScannedPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const png = await doc.embedPng(ONE_PX_PNG);
  page.drawImage(png, { x: 0, y: 0, width: 300, height: 300 });
  return Buffer.from(await doc.save());
}

/** XLSX with one sheet and two filled cells. */
export async function makeXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.getCell("A1").value = "Contractor";
  ws.getCell("B1").value = "Romashka";
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** DOCX with two paragraphs. */
export async function makeDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun("Contract terms")] }),
        new Paragraph({ children: [new TextRun("Net 30 days")] }),
      ],
    }],
  });
  return await Packer.toBuffer(doc);
}
