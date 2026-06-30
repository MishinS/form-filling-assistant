// Empirical CPU-only timing for the 3B local model (qwen2.5-3b, GPU Offload=0).
// Measured: ~1600-tok prompt ≈ 72 s; ~7000-tok prompt ≈ 250 s. Tunable.
const CHARS_PER_TOKEN = 3;        // Cyrillic-heavy text
const BASE_SECONDS = 10;          // fixed model load + decode overhead (kept < MIN_MS/1000 so empty text clamps to floor)
const SECONDS_PER_TOKEN = 0.033;  // prefill-dominated
const MIN_MS = 15_000;
const MAX_MS = 290_000;

export function estimateLocalMs(text: string): number {
  const tokens = text.length / CHARS_PER_TOKEN;
  const seconds = BASE_SECONDS + SECONDS_PER_TOKEN * tokens;
  return Math.min(MAX_MS, Math.max(MIN_MS, Math.round(seconds * 1000)));
}
