// Payment schedule for «График оплат». Phase 5: default-only (аванс 100%, single row).
// Modeled as a list so the future conditions-driven %-split (аванс 30 / постоплата 70)
// is a clean extension — see the design spec follow-up.

export interface ScheduleRow {
  stage: string;       // «Аванс» / «Постоплата» …
  percent: number;     // 0..100
  amount: number;      // money for this row
  due: number | null;  // Excel date serial, or null
}

export const round2 = (x: number) => Math.round(x * 100) / 100;

const MAX_STAGES = 5;

/**
 * Deterministic %-split parser for the f9 «Условия оплаты» free text.
 * Returns percents in order of appearance, or null → caller falls back to
 * the single «Аванс 100%» row. НДС clauses are stripped first so they never
 * count as payment stages.
 */
export function parseSplit(text: string): number[] | null {
  const cleaned = text
    .replace(/НДС[^,;.%]{0,20}?\d+(?:[.,]\d+)?\s*%/gi, " ")
    .replace(/\d+(?:[.,]\d+)?\s*%[^,;.%]{0,10}?НДС/gi, " ");
  const pcts = Array.from(
    cleaned.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g),
    m => parseFloat(m[1].replace(",", ".")),
  );
  if (pcts.length === 1 && pcts[0] > 0 && pcts[0] < 100) {
    return [pcts[0], round2(100 - pcts[0])];
  }
  if (pcts.length < 2 || pcts.length > MAX_STAGES) return null;
  if (pcts.some(p => p <= 0)) return null;
  const sum = pcts.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.01) return null;
  return pcts;
}

export function buildSchedule(total: number, due: number | null): ScheduleRow[] {
  return [{ stage: "Аванс", percent: 100, amount: total, due }];
}
