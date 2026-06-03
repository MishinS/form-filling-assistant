import { describe, it, expect } from "vitest";
import { parseAmount, parseDateSerial } from "./parse";

describe("parseAmount", () => {
  it("parses ru-RU NBSP/space + comma decimal", () => {
    expect(parseAmount("418 600,00")).toBe(418600);
    expect(parseAmount("418 600,00")).toBe(418600);
    expect(parseAmount("1 240 000,00")).toBe(1240000);
    expect(parseAmount("74 900,00 руб.")).toBe(74900);
  });
  it("returns null for non-numeric", () => {
    expect(parseAmount("руб.")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("—")).toBeNull();
  });
});

describe("parseDateSerial", () => {
  it("converts dd.mm.yyyy to an Excel serial", () => {
    expect(parseDateSerial("30.04.2026")).toBe(46142);
    expect(parseDateSerial("16.04.2026")).toBe(46128);
    expect(parseDateSerial("20.05.2026")).toBe(46162); // matches образец H16
  });
  it("returns null for unparseable input", () => {
    expect(parseDateSerial("not a date")).toBeNull();
    expect(parseDateSerial("2026-04-30")).toBeNull();
    expect(parseDateSerial("")).toBeNull();
  });
});
