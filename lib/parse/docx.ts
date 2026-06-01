import mammoth from "mammoth";
import type { ParseResult, ParsedBlock } from "./types";

export async function parseDocx(buf: Buffer): Promise<ParseResult> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  const lines = value.split("\n").map(l => l.trim()).filter(Boolean);
  const blocks: ParsedBlock[] = lines.map((text, i) => ({
    text,
    locator: { kind: "docx", block: i },
  }));
  return { pages: blocks.length, blocks, scannedPages: [], warnings: [] };
}
