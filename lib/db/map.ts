import type { ExtractedValue } from "@/lib/types";

export interface SourceInput {
  fileId: string;
  name: string;
  mime: string;
  size: string;
  pages: number;
  blobKey: string | null;
}

export interface FillPayload {
  templateId: string;
  values: ExtractedValue[];
  sources: SourceInput[];
}

export interface FillRow { id: string; userId: string; templateId: string; status: "done"; }
export interface SourceRow { id: string; fillId: string; name: string; mime: string; size: string; pages: number; blobKey: string | null; }
export interface ValueRow { id: string; fillId: string; fieldId: string; value: string; confidence: string; sourceFileId: string | null; locator: string | null; }

/** Map a completion payload into the exact rows for fills / source_files / extracted_values. */
export function buildFillRecord(id: string, userId: string, p: FillPayload): {
  fill: FillRow; sources: SourceRow[]; values: ValueRow[];
} {
  const fill: FillRow = { id, userId, templateId: p.templateId, status: "done" };
  const sources: SourceRow[] = p.sources.map((s, i) => ({
    id: `${id}-s${i}`,
    fillId: id,
    name: s.name,
    mime: s.mime,
    size: s.size,
    pages: s.pages,
    blobKey: s.blobKey ?? null,
  }));
  const values: ValueRow[] = p.values.map((v) => ({
    id: `${id}-${v.fieldId}`,
    fillId: id,
    fieldId: v.fieldId,
    value: v.value,
    confidence: v.confidence,
    sourceFileId: v.source?.fileId ?? null,
    locator: v.source?.locator ? v.source.locator : null,
  }));
  return { fill, sources, values };
}

/** Locale-aware short timestamp for the dashboard row. Isomorphic (Intl). */
export function formatFillDate(iso: string, lang: "ru" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Row shape returned by listFills (kept here so server + client agree). */
export interface HistoryRowData {
  id: string;
  templateId: string;
  status: string;
  createdAt: string;       // ISO
  fileCount: number;
  primaryFile: string | null;
  counterparty: string | null;
  amount: string | null;
  currency: string | null;
}
