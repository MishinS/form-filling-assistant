import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Localization guard.
 *
 * A string typed into a component cannot follow the language: it renders as the
 * wrong language for half the users. The rule is not "no Cyrillic in components"
 * but "no Cyrillic that cannot follow the language" — a per-language conditional
 * provably can, and comments are never rendered.
 *
 * The English half of the same defect (a hardcoded English aria-label) is not
 * mechanically detectable — English literals are indistinguishable from
 * identifiers — so the spec requirement covers both directions while this guard
 * covers the detectable one.
 */

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "components"];

const CYRILLIC = /[А-Яа-яЁё]/;

/** Lines that provably cannot leak: the string is chosen by the active language. */
const BILINGUAL = /lang\s*===\s*"ru"\s*\?|\bru\s*\?/;

/**
 * Cyrillic that is not UI copy. Each entry is a decision to revisit in review.
 */
const ALLOWED: { file: string; pattern: RegExp; why: string }[] = [
  { file: "components/templates/MappingEditor.tsx", pattern: /"ПТ!"/, why: "sheet name in the workbook, not copy" },
  { file: "components/templates/MiniSheet.tsx", pattern: /"ПТ!"/, why: "sheet name in the workbook, not copy" },
  { file: "components/wizard/DoneStep.tsx", pattern: /ПТ_\$\{|Ф15\.xlsx/, why: "output filename is a domain identifier" },
  {
    file: "app/layout.tsx",
    pattern: /description:/,
    why: "root metadata is RU-only until the language cookie can be read without making the whole tree dynamic (see fix-i18n-leaks proposal, non-goals)",
  },
];

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsxFiles(rel));
    else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) out.push(rel);
  }
  return out;
}

/** Strip comments so Russian notes to the reader are not mistaken for copy. */
function stripComments(source: string): string[] {
  let inBlock = false;
  return source.split("\n").map((line) => {
    let out = line;
    if (inBlock) {
      const end = out.indexOf("*/");
      if (end === -1) return "";
      out = out.slice(end + 2);
      inBlock = false;
    }
    for (;;) {
      const start = out.indexOf("/*");
      if (start === -1) break;
      const end = out.indexOf("*/", start + 2);
      if (end === -1) { out = out.slice(0, start); inBlock = true; break; }
      out = out.slice(0, start) + out.slice(end + 2);
    }
    const slash = out.indexOf("//");
    return slash === -1 ? out : out.slice(0, slash);
  });
}

describe("i18n leaks", () => {
  it("has no single-language copy in component source", () => {
    const offenders: string[] = [];
    for (const file of SCAN_DIRS.flatMap(tsxFiles)) {
      const lines = stripComments(readFileSync(path.join(ROOT, file), "utf8"));
      lines.forEach((line, i) => {
        if (!CYRILLIC.test(line) || BILINGUAL.test(line)) return;
        if (ALLOWED.some((a) => a.file === file && a.pattern.test(line))) return;
        offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
    }
    expect(
      offenders,
      `Hardcoded Russian cannot follow the language. Add a key to lib/seed/pt.ts and render it ` +
        `with t(), or document an exemption in ALLOWED in this file:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
