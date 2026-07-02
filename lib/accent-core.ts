// lib/accent-core.ts — pure, no React/DOM (safe to import on server and in node tests).
export type AccentId = "blue" | "teal" | "indigo" | "plum" | "rose";

export const ACCENTS: readonly { id: AccentId; hex: string }[] = [
  { id: "blue",   hex: "#0b5394" }, // default
  { id: "teal",   hex: "#0e6b6b" },
  { id: "indigo", hex: "#4a4fb0" },
  { id: "plum",   hex: "#8f4083" },
  { id: "rose",   hex: "#a2455f" },
] as const;

export const DEFAULT_ACCENT: AccentId = "blue";
export const ACCENT_COOKIE = "accent";

/** Strict membership guard (unknown / empty / non-string → false). Used by the API. */
export function isAccentId(value: unknown): value is AccentId {
  return typeof value === "string" && ACCENTS.some((a) => a.id === value);
}

/** Coerce an untrusted cookie/DB value into an AccentId (default "blue"). Never throws. */
export function parseAccentId(value: string | undefined | null): AccentId {
  return isAccentId(value) ? value : DEFAULT_ACCENT;
}
