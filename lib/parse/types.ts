export type Locator =
  | { kind: "pdf"; page: number }
  | { kind: "xlsx"; sheet: string; cell: string }
  | { kind: "docx"; block: number };

export interface ParsedBlock {
  text: string;
  locator: Locator;
}

/** What each format parser returns (document identity is added by the dispatcher). */
export interface ParseResult {
  pages: number;
  blocks: ParsedBlock[];
  scannedPages: number[];
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
