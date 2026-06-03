// Payment schedule for «График оплат». Phase 5: default-only (аванс 100%, single row).
// Modeled as a list so the future conditions-driven %-split (аванс 30 / постоплата 70)
// is a clean extension — see the design spec follow-up.

export interface ScheduleRow {
  stage: string;       // «Аванс» / «Постоплата» …
  percent: number;     // 0..100
  amount: number;      // money for this row
  due: number | null;  // Excel date serial, or null
}

export function buildSchedule(total: number, due: number | null): ScheduleRow[] {
  return [{ stage: "Аванс", percent: 100, amount: total, due }];
}
