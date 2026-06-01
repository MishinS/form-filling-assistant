import mammoth from "mammoth";
import type { ParseResult, ParsedBlock } from "./types";

export async function parseDocx(buf: Buffer): Promise<ParseResult> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  const lines = value.split("\n").map(l => l.trim()).filter(Boolean);
  const blocks: ParsedBlock[] = lines.map((text, i) => ({
    text,
    locator: { kind: "docx", block: i },
  }));
  // mammoth cannot recover physical page count from a .docx; report 1 rather than
  // misreporting the paragraph count as pages (the UI renders `pages` as "N стр.").
  return { pages: 1, blocks, scannedPages: [], warnings: [] };
}
