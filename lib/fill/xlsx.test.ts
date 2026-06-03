import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { fillPtXlsx } from "./xlsx";
import type { ExtractedValue } from "@/lib/types";

const tpl = new Uint8Array(readFileSync("lib/fill/templates/pt.xlsx"));
const ev = (fieldId: string, value: string): ExtractedValue => ({
  fieldId, value, confidence: "high", source: { fileId: null, locator: "" },
});

describe("fillPtXlsx", () => {
  const out = fillPtXlsx(tpl, [
    ev("f1", 'ООО «Ромашка» & Co'),
    ev("f4", "100 000,00"),
    ev("f10", "30.04.2026"),
  ]);
  const files = unzipSync(out);
  const orig = unzipSync(tpl);

  it("produces a valid zip (PK signature)", () => {
    expect(out[0]).toBe(0x50);
    expect(out[1]).toBe(0x4b);
  });

  it("writes the counterparty into ПТ!D9, XML-escaped", () => {
    const pt = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(pt).toContain("ООО «Ромашка» &amp; Co");
  });

  it("writes the срок serial into ПТ!H16 and refreshes ПТ!D13/D15 caches", () => {
    const pt = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(pt).toContain("<v>46142</v>"); // H16 + E5 share this serial
    expect(pt).toMatch(/<c r="D13"[^>]*><f>[^<]*<\/f><v>100000<\/v><\/c>/);
    expect(pt).toMatch(/<c r="D15"[^>]*><f>[^<]*<\/f><v>100000<\/v><\/c>/);
  });

  it("writes the total into «График оплат»!D5", () => {
    const graf = strFromU8(files["xl/worksheets/sheet3.xml"]);
    expect(graf).toContain("<v>100000</v>"); // D5
  });

  it("preserves the comment and untouched sheets byte-for-byte", () => {
    expect(files["xl/comments/comment1.xml"]).toBeDefined();
    expect(strFromU8(files["xl/worksheets/sheet2.xml"]))
      .toBe(strFromU8(orig["xl/worksheets/sheet2.xml"]));
    expect(strFromU8(files["xl/worksheets/sheet4.xml"]))
      .toBe(strFromU8(orig["xl/worksheets/sheet4.xml"]));
  });
});
