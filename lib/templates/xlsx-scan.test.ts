import { describe,it,expect } from "vitest";
import { zipSync,strToU8 } from "fflate";
import { workbookSheets,sheetTexts,decodeXml } from "./xlsx-scan";

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
  it("throws on non-zip bytes", () => {
    expect(() => workbookSheets(strToU8("not a zip"))).toThrow();
  });
});

describe("sheetTexts", () => {
  it("resolves shared strings and numeric values", () => {
    const [s1] = sheetTexts(fixtureXlsx());
    expect(s1.name).toBe("Лист1");
    expect(s1.lines).toEqual(["A1: Поставщик", "B2: 42"]);
  });
});

describe("decodeXml", () => {
  it("decodes decimal numeric character references (Cyrillic)", () => {
    // &#1055;&#1051;&#1040;&#1058; = ПЛАТ
    expect(decodeXml("&#1055;&#1051;&#1040;&#1058;")).toBe("ПЛАТ");
  });
  it("does NOT mis-decode a literal &amp;#1055; into П", () => {
    // raw text that means the literal string "&#1055;" must stay literal
    expect(decodeXml("&amp;#1055;")).toBe("&#1055;");
  });
});
