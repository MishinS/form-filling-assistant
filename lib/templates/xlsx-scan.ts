// Read-only structure scan of an uploaded XLSX: sheet list (workbook.xml + rels)
// and per-sheet "A1: value" text lines for the LLM field-proposal prompt.
import { unzipSync, strFromU8 } from "fflate";

export interface SheetRef { name: string; file: string }
export interface SheetText { name: string; lines: string[] }

const MAX_LINES_PER_SHEET = 200;

// Decode XML char references. Numeric refs (&#NNNN; / &#xHHHH;) MUST be decoded
// BEFORE &amp;→& so a literal "&amp;#1055;" is not mis-decoded into a Cyrillic char.
// This образец-class file stores Cyrillic as numeric refs; without this the LLM
// scan prompt gets unreadable, ~3x-bloated text and times out (see spec).
export const decodeXml = (s: string) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Sheet names in workbook order mapped to their zip entry paths, from already-unzipped files. */
export function sheetsFromFiles(files: Record<string, Uint8Array>): SheetRef[] {
  const wbEntry = files["xl/workbook.xml"];
  const relsEntry = files["xl/_rels/workbook.xml.rels"];
  if (!wbEntry || !relsEntry) throw new Error("Не XLSX: нет workbook.xml");
  const rels = strFromU8(relsEntry);
  const relTarget = new Map<string, string>();
  for (const m of Array.from(rels.matchAll(/<Relationship\b([^>]*)\/?>/g))) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[1])?.[1];
    if (id && target) relTarget.set(id, target);
  }
  const out: SheetRef[] = [];
  for (const m of Array.from(strFromU8(wbEntry).matchAll(/<sheet\b([^>]*)\/?>/g))) {
    const name = /\bname="([^"]+)"/.exec(m[1])?.[1];
    const rid = /\br:id="([^"]+)"/.exec(m[1])?.[1];
    const target = rid ? relTarget.get(rid) : undefined;
    if (!name || !target) continue;
    const file = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    out.push({ name: decodeXml(name), file });
  }
  if (out.length === 0) throw new Error("В файле нет листов");
  return out;
}

/** Sheet names in workbook order mapped to their zip entry paths. Throws on non-XLSX. */
export function workbookSheets(bytes: Uint8Array): SheetRef[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("Не XLSX: не удалось распаковать архив");
  }
  return sheetsFromFiles(files);
}

/** Per-sheet "A1: value" lines (shared strings, inline strings, numbers). */
export function sheetTexts(bytes: Uint8Array): SheetText[] {
  const files = unzipSync(bytes);
  const shared: string[] = [];
  const sst = files["xl/sharedStrings.xml"];
  if (sst) {
    for (const m of Array.from(strFromU8(sst).matchAll(/<si>([\s\S]*?)<\/si>/g))) {
      shared.push(decodeXml(m[1].replace(/<[^>]+>/g, "")));
    }
  }
  return sheetsFromFiles(files).map(({ name, file }) => {
    const entry = files[file];
    const xml = entry ? strFromU8(entry) : "";
    const lines: string[] = [];
    for (const m of Array.from(xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g))) {
      if (lines.length >= MAX_LINES_PER_SHEET) break;
      const ref = /\br="([A-Z]{1,3}\d+)"/.exec(m[1])?.[1];
      if (!ref) continue;
      const t = /\bt="([^"]+)"/.exec(m[1])?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(m[2])?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(m[2])?.[1];
      if (v == null) continue;
      const text = t === "s" ? (shared[Number(v)] ?? "") : decodeXml(v);
      if (text.trim()) lines.push(`${ref}: ${text.trim()}`);
    }
    return { name, lines };
  });
}
