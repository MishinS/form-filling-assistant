import type { ExtractedValue } from "@/lib/types";

export type ExtractResult = {
  values: ExtractedValue[];
  warnings: string[];
  llmFailed: boolean;
  usedModel: string | null;
};

/**
 * Read newline-delimited extract events and return the terminal `result` event,
 * or null if absent. Blank/malformed lines and non-result events are skipped.
 *
 * This is the trust boundary for the extract stream: a `result` event is only
 * accepted once its `values` is known to be an array, and the remaining fields
 * are normalised, so callers never receive a result that lies about its shape.
 */
export function parseExtractResult(ndjson: string): ExtractResult | null {
  let found: ExtractResult | null = null;
  for (const line of ndjson.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let ev: unknown;
    try { ev = JSON.parse(s); } catch { continue; }
    if (ev && typeof ev === "object" && (ev as { type?: string }).type === "result") {
      const r = ev as Partial<ExtractResult>;
      if (!Array.isArray(r.values)) continue; // malformed result line
      found = {
        values: r.values,
        warnings: Array.isArray(r.warnings) ? r.warnings : [],
        llmFailed: r.llmFailed === true,
        usedModel: typeof r.usedModel === "string" ? r.usedModel : null,
      };
    }
  }
  return found;
}
