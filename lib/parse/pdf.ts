import { extractText, getDocumentProxy } from "unpdf";
import type { ParseResult, ParsedBlock } from "./types";

export async function parsePdf(buf: Buffer): Promise<ParseResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pagesText = text as string[];

  const blocks: ParsedBlock[] = [];
  const scannedPages: number[] = [];
  pagesText.forEach((raw, i) => {
    const page = i + 1;
    const trimmed = (raw ?? "").trim();
    if (trimmed) blocks.push({ text: trimmed, locator: { kind: "pdf", page } });
    else scannedPages.push(page);
  });

  const warnings = scannedPages.length
    ? [`Страницы без текстового слоя: ${scannedPages.join(", ")} — будут распознаны (фаза 4)`]
    : [];
  return { pages: totalPages, blocks, scannedPages, warnings };
}
