// Payment schedule for «График оплат»: a single «Аванс 100%» row by default,
// or one row per stage when the f9 terms text carries a parseable %-split.

export interface ScheduleRow {
  stage: string;       // «Аванс» / «Постоплата» …
  percent: number;     // 0..100
  amount: number;      // money for this row
  due: number | null;  // Excel date serial, or null
}

export const round2 = (x: number) => Math.round(x * 100) / 100;

const MAX_STAGES = 5;

// Percents that are taxes/rates/penalties, not payment stages: «НДС 20%»,
// «пени 0,1%», «ставка 8,25%», «штраф 10%»… Stripped before scanning.
// NB: \w and \b are ASCII-only in JS — Cyrillic needs explicit [а-яё]* (i-flag covers case).
const NON_STAGE = "(?:НДС|пени|пеня|штраф[а-яё]*|неустойк[а-яё]*|ставк[а-яё]*)";

/**
 * Deterministic %-split parser for the f9 «Условия оплаты» free text.
 * Returns percents in order of appearance, or null → caller falls back to
 * the single «Аванс 100%» row. НДС/penalty/rate clauses are stripped first
 * so they never count as payment stages.
 */
export function parseSplit(text: string): number[] | null {
  const cleaned = text
    .replace(new RegExp(`${NON_STAGE}[^,;.%]{0,20}?\\d+(?:[.,]\\d+)?\\s*%`, "gi"), " ")
    .replace(new RegExp(`\\d+(?:[.,]\\d+)?\\s*%[^,;.%]{0,10}?${NON_STAGE}`, "gi"), " ");
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

/** «30%» / «12,5%» — percent column rendering, ru decimal comma. */
export const formatPercent = (p: number) => `${String(p).replace(".", ",")}%`;

const stageName = (i: number, k: number): string => {
  if (i === 0) return "Аванс";
  if (i === k - 1) return "Постоплата";
  return `Платёж ${i + 1}`;
};

/**
 * Build the «График оплат» rows. With parseable terms text → one row per stage,
 * kopeck-exact amounts (last row takes the remainder), dues always empty.
 * Otherwise → the single «Аванс 100%» row carrying the f10 due (legacy path).
 */
export function buildSchedule(total: number, due: number | null, termsText?: string): ScheduleRow[] {
  const split = termsText ? parseSplit(termsText) : null;
  if (!split) return [{ stage: "Аванс", percent: 100, amount: total, due }];
  const k = split.length;
  let allocated = 0;
  return split.map((percent, i) => {
    const amount = i === k - 1 ? round2(total - allocated) : round2((total * percent) / 100);
    allocated = round2(allocated + amount);
    return { stage: stageName(i, k), percent, amount, due: null };
  });
}
