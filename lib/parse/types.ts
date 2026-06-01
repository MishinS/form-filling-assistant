export type Locator =
  | { kind: "pdf"; page: number }            // page: 1-indexed (matches PDF viewer/`scannedPages` convention)
  | { kind: "xlsx"; sheet: string; cell: string }
  | { kind: "docx"; block: number };         // block: 0-indexed position among non-empty parsed paragraphs

export interface ParsedBlock {
  text: string;
  locator: Locator;
}

/** What each format parser returns (document identity is added by the dispatcher). */
export interface ParseResult {
  pages: number;
  blocks: ParsedBlock[];
  scannedPages: number[];   // 1-indexed page numbers with no extractable text layer (for phase-4 OCR)
  warnings: string[];
}

export interface ParsedDoc extends ParseResult {
  fileId: string;
  name: string;
  mime: string;
}

export const MIME = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;
