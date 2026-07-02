import { isValidValue } from "./validate";

export type Attention = "low" | "invalid" | "required" | null;

/** Classify one field. Precedence: invalid > required > low > null. */
export function attentionOf(input: { kind: string; required: boolean; conf: "low" | "med" | "high"; value: string }): Attention {
  if (!isValidValue(input.kind, input.value)) return "invalid";
  if (input.required && input.value.trim() === "") return "required";
  if (input.conf === "low") return "low";
  return null;
}

/** Index of the next row after `fromIndex` (wrapping) whose attention !== null, or -1 if none. */
export function nextAttentionIndex(rows: { attention: Attention }[], fromIndex: number): number {
  const n = rows.length;
  for (let step = 1; step <= n; step++) {
    const i = (((fromIndex + step) % n) + n) % n;
    if (rows[i].attention !== null) return i;
  }
  return -1;
}
