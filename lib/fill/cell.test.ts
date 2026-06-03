import { describe, it, expect } from "vitest";
import { writeCell, setFormulaCache } from "./cell";

describe("writeCell", () => {
  it("writes an inline string, preserves style, escapes XML", () => {
    const xml = '<row r="9"><c r="D9" s="50" t="inlineStr"><is><t>old</t></is></c></row>';
    const out = writeCell(xml, "D9", "string", 'ООО "Х" & <Y>');
    expect(out).toContain('s="50"');
    expect(out).toContain('t="inlineStr"');
    expect(out).toContain('ООО "Х" &amp; &lt;Y&gt;');
    expect(out).not.toContain("<t>old</t>");
  });

  it("writes a number into an empty numeric cell, dropping t and inner", () => {
    const xml = '<row r="14"><c r="D14" s="41" t="n"></c></row>';
    const out = writeCell(xml, "D14", "number", 1000);
    expect(out).toContain('<c r="D14" s="41"><v>1000</v></c>');
  });

  it("overwrites a numeric cell that already had a value", () => {
    const xml = '<c r="H16" s="15" t="n"><v>46162</v></c>';
    const out = writeCell(xml, "H16", "number", 46142);
    expect(out).toBe('<c r="H16" s="15"><v>46142</v></c>');
  });

  it("throws when the target cell is absent", () => {
    expect(() => writeCell('<row r="1"></row>', "Z9", "string", "x")).toThrow(/Z9/);
  });
});

describe("setFormulaCache", () => {
  it("keeps the formula and swaps the cached <v>", () => {
    const xml = `<c r="D13" s="45"><f>'График оплат'!D6</f><v></v></c>`;
    const out = setFormulaCache(xml, "D13", 142275);
    expect(out).toContain(`<f>'График оплат'!D6</f>`);
    expect(out).toContain("<v>142275</v>");
    expect(out).not.toContain("<v></v>");
  });
});
