import { MIME, type ParsedDoc } from "./types";
import { parsePdf } from "./pdf";
import { parseXlsx } from "./xlsx";
import { parseDocx } from "./docx";

export async function parseDocument(
  buf: Buffer,
  mime: string,
  meta: { fileId: string; name: string },
): Promise<ParsedDoc> {
  const base = { fileId: meta.fileId, name: meta.name, mime };
  if (mime === MIME.pdf) return { ...base, ...(await parsePdf(buf)) };
  if (mime === MIME.xlsx) return { ...base, ...(await parseXlsx(buf)) };
  if (mime === MIME.docx) return { ...base, ...(await parseDocx(buf)) };
  return { ...base, pages: 0, blocks: [], scannedPages: [], warnings: [`Неподдерживаемый тип: ${mime}`] };
}
