import { describe, it, expect } from "vitest";
import { zipSync, strToU8, unzipSync } from "fflate";
import { workbookSheets, sheetTexts, sheetsFromFiles, decodeXml } from "./xlsx-scan";

/** Minimal two-sheet workbook: Лист1 (shared string in A1, number in B2), Данные (inline string in C3). */
export function fixtureXlsx(): Uint8Array {
  return zipSync({
    "xl/workbook.xml": strToU8(
      `<workbook><sheets>` +
      `<sheet name="Лист1" sheetId="1" r:id="rId1"/>` +
      `<sheet name="Данные" sheetId="2" r:id="rId2"/>` +
      `</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships>` +
      `<Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="ws" Target="worksheets/sheet2.xml"/>` +
      `</Relationships>`),
    "xl/sharedStrings.xml": strToU8(`<sst><si><t>Поставщик</t></si></sst>`),
    "xl/worksheets/sheet1.xml": strToU8(
      `<worksheet><sheetData>` +
      `<row r="1"><c r="A1" t="s"><v>0</v></c></row>` +
      `<row r="2"><c r="B2"><v>42</v></c></row>` +
      `</sheetData></worksheet>`),
    "xl/worksheets/sheet2.xml": strToU8(
      `<worksheet><sheetData>` +
      `<row r="3"><c r="C3" t="inlineStr"><is><t>Итого</t></is></c></row>` +
      `</sheetData></worksheet>`),
  });
}

describe("workbookSheets", () => {
  it("maps sheet names to worksheet files in workbook order", () => {
    expect(workbookSheets(fixtureXlsx())).toEqual([
      { name: "Лист1", file: "xl/worksheets/sheet1.xml" },
      { name: "Данные", file: "xl/worksheets/sheet2.xml" },
    ]);
  });
  it("throws on a zip without workbook.xml", () => {
    const garbage = zipSync({ "hello.txt": strToU8("hi") });
    expect(() => workbookSheets(garbage)).toThrow();
  });
  it("throws on non-zip bytes", () => {
    expect(() => workbookSheets(strToU8("not a zip"))).toThrow();
  });
});

describe("sheetsFromFiles", () => {
  it("maps sheets from already-unzipped files (no re-unzip)", () => {
    const files = unzipSync(fixtureXlsx());
    expect(sheetsFromFiles(files)).toEqual([
      { name: "Лист1", file: "xl/worksheets/sheet1.xml" },
      { name: "Данные", file: "xl/worksheets/sheet2.xml" },
    ]);
  });
});

describe("sheetTexts", () => {
  it("resolves shared strings and numeric values", () => {
    const [s1] = sheetTexts(fixtureXlsx());
    expect(s1.name).toBe("Лист1");
    expect(s1.lines).toEqual(["A1: Поставщик", "B2: 42"]);
  });
  it("reads inline strings", () => {
    const [, s2] = sheetTexts(fixtureXlsx());
    expect(s2.lines).toEqual(["C3: Итого"]);
  });
});

describe("decodeXml", () => {
  it("decodes decimal numeric character references (Cyrillic)", () => {
    // &#1055;&#1051;&#1040;&#1058; = ПЛАТ
    expect(decodeXml("&#1055;&#1051;&#1040;&#1058;")).toBe("ПЛАТ");
  });
  it("decodes hex numeric character references", () => {
    // &#x41F; = 0x41F = 1055 = П
    expect(decodeXml("&#x41F;")).toBe("П");
  });
  it("still decodes named entities", () => {
    expect(decodeXml("&lt;a&gt; &amp; &quot;x&quot; &apos;y&apos;")).toBe(`<a> & "x" 'y'`);
  });
  it("does NOT mis-decode a literal &amp;#1055; into П", () => {
    // raw text that means the literal string "&#1055;" must stay literal
    expect(decodeXml("&amp;#1055;")).toBe("&#1055;");
  });
  it("leaves an out-of-range numeric ref literal instead of throwing", () => {
    // codepoints > 0x10FFFF would make String.fromCodePoint throw; a corrupt ref
    // in one cell must not get the whole template rejected as «not xlsx».
    expect(decodeXml("&#9999999999;")).toBe("&#9999999999;");
    expect(decodeXml("&#x110000;")).toBe("&#x110000;");
  });
});

describe("sheetTexts numeric entities", () => {
  it("decodes numeric-entity cell text to readable Cyrillic", () => {
    const bytes = zipSync({
      "xl/workbook.xml": strToU8(`<workbook><sheets><sheet name="ПТ" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>`),
      "xl/worksheets/sheet1.xml": strToU8(
        `<worksheet><sheetData>` +
        `<row r="1"><c r="B1" t="inlineStr"><is><t>&#1055;&#1051;&#1040;&#1058;&#1045;&#1046;</t></is></c></row>` +
        `</sheetData></worksheet>`),
    });
    expect(sheetTexts(bytes)[0].lines).toEqual(["B1: ПЛАТЕЖ"]);
  });
});
