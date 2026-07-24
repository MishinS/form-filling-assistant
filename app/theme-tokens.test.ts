import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Theme-token guard.
 *
 * The palette lives in `app/globals.css` and is defined twice — once per theme.
 * A color literal inlined in a component cannot follow the theme: it renders the
 * wrong hue (or nothing at all) in the theme its author was not looking at. This
 * scan keeps that defect class out, and keeps the deliberate exceptions visible.
 */

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "components"];

/** Themed values every component must reach through a token. */
const TOKENS = ["--ok-border", "--warn-border", "--bad-border", "--info-bg", "--muted-bg", "--hover"];

const COLOR_LITERAL = /rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g;

/**
 * Colors that are deliberately theme-independent. Adding an entry here is a
 * decision to make in review — that is the point of enumerating them.
 */
const ALLOWED: { pattern: RegExp; why: string; file?: string }[] = [
  { pattern: /^rgba\(0,\s*0,\s*0/, why: "black drop shadows read the same in both themes" },
  { pattern: /^rgba\(6,\s*9,\s*8/, why: "modal scrim is a fixed dark veil by design" },
  { pattern: /^#(000|fff)$/i, file: "components/shell/SettingsCog.tsx", why: "SVG mask fills, not UI color" },
];

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsxFiles(rel));
    // Tests never render — only production component source is scanned.
    else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) out.push(rel);
  }
  return out;
}

function themeBlock(css: string, selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `missing ${selector} block in globals.css`).toBeGreaterThan(-1);
  const open = css.indexOf("{", at);
  return css.slice(open, css.indexOf("}", open));
}

describe("theme tokens", () => {
  const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
  const dark = themeBlock(css, ":root{");
  const light = themeBlock(css, ':root[data-theme="light"]');

  it("declares every semantic token in both theme blocks", () => {
    for (const token of TOKENS) {
      expect(dark, `${token} missing from the dark block`).toContain(`${token}:`);
      expect(light, `${token} missing from the light block`).toContain(`${token}:`);
    }
  });

  it("has no frozen color literals in component source", () => {
    const offenders: string[] = [];
    for (const file of SCAN_DIRS.flatMap(tsxFiles)) {
      const lines = readFileSync(path.join(ROOT, file), "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const lit of line.match(COLOR_LITERAL) ?? []) {
          const ok = ALLOWED.some((a) => a.pattern.test(lit) && (!a.file || a.file === file));
          if (!ok) offenders.push(`${file}:${i + 1}  ${lit}`);
        }
      });
    }
    expect(
      offenders,
      `Inline color literals cannot follow the theme. Use a token from app/globals.css ` +
        `(${TOKENS.join(", ")}, or an existing --ok-bg/--warn-bg/--bad-bg/--line*), or add a ` +
        `documented exemption to ALLOWED in this file:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
