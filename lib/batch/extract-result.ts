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
 */
export function parseExtractResult(ndjson: string): ExtractResult | null {
  let found: ExtractResult | null = null;
  for (const line of ndjson.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let ev: unknown;
    try { ev = JSON.parse(s); } catch { continue; }
    if (ev && typeof ev === "object" && (ev as { type?: string }).type === "result") {
      const r = ev as ExtractResult & { type: string };
      found = { values: r.values, warnings: r.warnings, llmFailed: r.llmFailed, usedModel: r.usedModel };
    }
  }
  return found;
}
