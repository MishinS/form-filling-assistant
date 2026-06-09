// lib/theme.ts — pure, no React/DOM (safe to import on server and in node tests).
export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_COOKIE = "theme";

/** Coerce an untrusted cookie value into a ThemeMode (default "system"). */
export function parseThemeMode(value: string | undefined | null): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/** Resolve a mode + device preference into the concrete theme to apply. */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}
