import { describe,it,expect } from "vitest";
import { readFileSync } from "node:fs";
import { unzipSync,zipSync,strToU8,strFromU8 } from "fflate";
import { fillPtXlsx,fillCustomXlsx } from "./xlsx";
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

  it("writes the counterparty into ПТ!D9, XML-escaped", () => {
    const pt = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(pt).toContain("ООО «Ромашка» &amp; Co");
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
  it("writes amounts as numbers", () => {
    const out = fillCustomXlsx(customFixture(), [{ fieldId: "f1", value: "1 234,50", confidence: "high", source: { fileId: null, locator: "" } }], [F({ kind: "amount" })]);
    const xml = strFromU8(unzipSync(out)["xl/worksheets/sheet1.xml"]);
    expect(xml).toMatch(/<v>1234.5<\/v>/);
  });
  it("skips fields whose sheet is missing instead of throwing", () => {
    const out = fillCustomXlsx(customFixture(), [{ fieldId: "f1", value: "x", confidence: "high", source: { fileId: null, locator: "" } }], [F({ cell: "Нет!A1" })]);
    expect(unzipSync(out)["xl/worksheets/sheet1.xml"]).toBeDefined();
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
  it("repoints ПТ!D13 to !D7 and caches D13=100000 / D15=30000", () => {
    expect(pt).toMatch(/<c r="D13"[^>]*><f>[^<]*!D7<\/f><v>100000<\/v>/);
    expect(pt).toMatch(/<c r="D15"[^>]*><f>[^<]*!D5<\/f><v>30000<\/v>/);
  });
});

describe("fillPtXlsx with a 3-stage split", () => {
  it("inserts two rows, names the middle stage, repoints Итого to D8", () => {
    const out = fillPtXlsx(tpl, [
      ev("f4", "90 000,00"),
      ev("f9", "оплата: 50%, затем 30%, затем 20%"),
    ]);
    const files = unzipSync(out);
    const graf = strFromU8(files["xl/worksheets/sheet3.xml"]);
    const pt = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(graf).toMatch(/<c r="B6"[^>]*><is><t[^>]*>Платёж 2<\/t>/);
    expect(graf).toMatch(/<c r="B7"[^>]*><is><t[^>]*>Постоплата<\/t>/);
    expect(graf).toMatch(/<c r="D7"[^>]*><v>18000<\/v>/);
    expect(graf).toContain("SUM(D5:D7)");
    expect(graf).toContain('<dimension ref="A1:F20"');
    expect(pt).toMatch(/<c r="D13"[^>]*><f>[^<]*!D8<\/f><v>90000<\/v>/);
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


