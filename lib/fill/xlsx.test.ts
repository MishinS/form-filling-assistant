import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { fillPtXlsx, fillCustomXlsx } from "./xlsx";
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

const customFixture = () => zipSync({
  "xl/workbook.xml": strToU8(`<workbook><sheets><sheet name="Форма" sheetId="1" r:id="rId1"/></sheets></workbook>`),
  "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>`),
  "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData><row r="1"><c r="A1" t="str"><v>x</v></c></row></sheetData></worksheet>`),
  "docProps/app.xml": strToU8(`<Properties/>`),
});
const F = (over: Partial<import("@/lib/extract/fields").ExtractField>) => ({
  id: "f1", group: "req" as const, label_ru: "x", label_en: "x", cell: "Форма!B2",
  kind: "string" as const, required: false, strategy: "llm" as const, ...over,
});

describe("fillCustomXlsx", () => {
  it("writes a string value into its sheet cell", () => {
    const out = fillCustomXlsx(customFixture(), [{ fieldId: "f1", value: "ООО Ромашка", confidence: "high" }], [F({})]);
    const xml = strFromU8(unzipSync(out)["xl/worksheets/sheet1.xml"]);
    expect(xml).toContain("ООО Ромашка");
  });
  it("writes amounts as numbers", () => {
    const out = fillCustomXlsx(customFixture(), [{ fieldId: "f1", value: "1 234,50", confidence: "high" }], [F({ kind: "amount" })]);
    const xml = strFromU8(unzipSync(out)["xl/worksheets/sheet1.xml"]);
    expect(xml).toMatch(/<v>1234.5<\/v>/);
  });
  it("skips fields whose sheet is missing instead of throwing", () => {
    const out = fillCustomXlsx(customFixture(), [{ fieldId: "f1", value: "x", confidence: "high" }], [F({ cell: "Нет!A1" })]);
    expect(unzipSync(out)["xl/worksheets/sheet1.xml"]).toBeDefined();
  });
  it("preserves unrelated zip entries", () => {
    const out = fillCustomXlsx(customFixture(), [], []);
    expect(unzipSync(out)["docProps/app.xml"]).toBeDefined();
  });
});
