import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { fillPtXlsx, fillCustomXlsx, insertScheduleRows, retargetItogoFormula } from "./xlsx";
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
    const out = fillCustomXlsx(customFixture(), [{ fieldId: "f1", value: "ООО Ромашка", confidence: "high", source: { fileId: null, locator: "" } }], [F({})]);
    const xml = strFromU8(unzipSync(out)["xl/worksheets/sheet1.xml"]);
    expect(xml).toContain("ООО Ромашка");
  });
  it("writes amounts as numbers", () => {
    const out = fillCustomXlsx(customFixture(), [{ fieldId: "f1", value: "1 234,50", confidence: "high", source: { fileId: null, locator: "" } }], [F({ kind: "amount" })]);
    const xml = strFromU8(unzipSync(out)["xl/worksheets/sheet1.xml"]);
    expect(xml).toMatch(/<v>1234.5<\/v>/);
  });
  it("skips fields whose sheet is missing instead of throwing", () => {
    const out = fillCustomXlsx(customFixture(), [{ fieldId: "f1", value: "x", confidence: "high", source: { fileId: null, locator: "" } }], [F({ cell: "Нет!A1" })]);
    expect(unzipSync(out)["xl/worksheets/sheet1.xml"]).toBeDefined();
  });
  it("preserves unrelated zip entries", () => {
    const out = fillCustomXlsx(customFixture(), [], []);
    expect(unzipSync(out)["docProps/app.xml"]).toBeDefined();
  });
});

describe("insertScheduleRows", () => {
  const sheet3 = strFromU8(unzipSync(tpl)["xl/worksheets/sheet3.xml"]);
  const out = insertScheduleRows(sheet3, 2); // k=2 → вставить 1 строку

  it("inserts a styled row 6 after the data row 5", () => {
    expect(out).toContain('<row r="6" ht="20" customHeight="1" s="38">');
    expect(out).toContain('<c r="B6" s="84"');
    expect(out).toContain('<c r="D6" s="86"');
  });
  it("renumbers the rows below (Итого 6→7, примечания 8/9→9/10)", () => {
    expect(out).toContain('<row r="7"');
    expect(out).toMatch(/<c r="A7"[^>]*><is><t>[^<]*<\/t><\/is>/); // Итого теперь в A7
    expect(out).not.toMatch(/<row r="6"[^>]*>(?:(?!<\/row>).)*SUM/); // SUM больше не в строке 6
  });
  it("extends the Итого SUM range", () => {
    expect(out).toContain("SUM(D5:D6)");
    expect(out).not.toContain("SUM(D5:D5)");
  });
  it("shifts merges below and the dimension, keeps A1:E1", () => {
    expect(out).toContain('<mergeCell ref="A1:E1"');
    expect(out).toContain('<mergeCell ref="A9:E9"');
    expect(out).toContain('<mergeCell ref="A10:E10"');
    expect(out).not.toContain('<mergeCell ref="A8:E8"');
    expect(out).toContain('<dimension ref="A1:F19"');
  });
  it("is a no-op for k=1", () => {
    expect(insertScheduleRows(sheet3, 1)).toBe(sheet3);
  });
});

describe("retargetItogoFormula", () => {
  const sheet1 = strFromU8(unzipSync(tpl)["xl/worksheets/sheet1.xml"]);

  it("repoints ПТ!D13 from !D6 to the shifted Итого row", () => {
    const out = retargetItogoFormula(sheet1, 2);
    expect(out).toMatch(/<c r="D13"[^>]*><f>[^<]*!D7<\/f>/);
    expect(out).toMatch(/<c r="D15"[^>]*><f>[^<]*!D5<\/f>/); // аванс не тронут
  });
  it("is a no-op for k=1", () => {
    expect(retargetItogoFormula(sheet1, 1)).toBe(sheet1);
  });
});

describe("fillPtXlsx with a 30/70 split in f9", () => {
  const out = fillPtXlsx(tpl, [
    ev("f1", "ООО «Ромашка»"),
    ev("f4", "100 000,00"),
    ev("f9", "аванс 30%, постоплата 70%"),
    ev("f10", "30.04.2026"),
  ]);
  const files = unzipSync(out);
  const graf = strFromU8(files["xl/worksheets/sheet3.xml"]);
  const pt = strFromU8(files["xl/worksheets/sheet1.xml"]);

  it("fills both schedule rows with stages, percents, amounts and №", () => {
    expect(graf).toMatch(/<c r="B5"[^>]*t="inlineStr"><is><t[^>]*>Аванс<\/t>/);
    expect(graf).toMatch(/<c r="C5"[^>]*t="inlineStr"><is><t[^>]*>30%<\/t>/);
    expect(graf).toMatch(/<c r="D5"[^>]*><v>30000<\/v>/);
    expect(graf).toMatch(/<c r="A6"[^>]*><v>2<\/v>/);
    expect(graf).toMatch(/<c r="B6"[^>]*t="inlineStr"><is><t[^>]*>Постоплата<\/t>/);
    expect(graf).toMatch(/<c r="C6"[^>]*t="inlineStr"><is><t[^>]*>70%<\/t>/);
    expect(graf).toMatch(/<c r="D6"[^>]*><v>70000<\/v>/);
  });
  it("leaves all schedule dues empty (E5/E6 carry no value)", () => {
    expect(graf).not.toMatch(/<c r="E5"[^>]*><v>/);
    expect(graf).not.toMatch(/<c r="E6"[^>]*><v>/);
  });
  it("moves Итого to row 7 with the extended SUM", () => {
    expect(graf).toContain("SUM(D5:D6)");
  });
  it("repoints ПТ!D13 to !D7 and caches D13=100000 / D15=30000", () => {
    expect(pt).toMatch(/<c r="D13"[^>]*><f>[^<]*!D7<\/f><v>100000<\/v>/);
    expect(pt).toMatch(/<c r="D15"[^>]*><f>[^<]*!D5<\/f><v>30000<\/v>/);
  });
  it("still preserves untouched sheets byte-for-byte", () => {
    const orig = unzipSync(tpl);
    expect(strFromU8(files["xl/worksheets/sheet2.xml"]))
      .toBe(strFromU8(orig["xl/worksheets/sheet2.xml"]));
  });
});

describe("fillPtXlsx single-row regression (no f9 split)", () => {
  it("matches the legacy output byte-for-byte", () => {
    const vals = [ev("f4", "100 000,00"), ev("f10", "30.04.2026")];
    const legacy = fillPtXlsx(tpl, vals);
    const withDullF9 = fillPtXlsx(tpl, [...vals, ev("f9", "оплата в течение 30 дней")]);
    const a = unzipSync(legacy); const b = unzipSync(withDullF9);
    // f9 пишется в ПТ!D16, поэтому sheet1 различается; график и формулы — нет:
    expect(strFromU8(a["xl/worksheets/sheet3.xml"]))
      .toBe(strFromU8(b["xl/worksheets/sheet3.xml"]));
    expect(strFromU8(b["xl/worksheets/sheet3.xml"])).toContain("SUM(D5:D5)");
  });
});
