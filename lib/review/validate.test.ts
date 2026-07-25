import { describe, it, expect } from "vitest";
import { isValidValue, invalidReason } from "./validate";

describe("isValidValue", () => {
  it("amount: accepts numbers with spaces, commas, currency", () => {
    for (const v of ["1 200,50", "$99", "99.90", "1,234", "1000", "-5"]) expect(isValidValue("amount", v)).toBe(true);
  });
  it("amount: rejects non-numeric", () => {
    for (const v of ["abc", "12ab", "1.2.3"]) expect(isValidValue("amount", v)).toBe(false);
  });
  it("date: accepts real dates in common formats", () => {
    for (const v of ["01.02.2026", "2026-02-01", "1/2/2026"]) expect(isValidValue("date", v)).toBe(true);
  });
  it("date: rejects impossible calendar dates", () => {
    for (const v of ["31.31.2026", "2026-13-01", "45.01.2026", "31.02.2026"]) expect(isValidValue("date", v)).toBe(false);
  });
  it("date: accepts free-form terms, which the fill layer writes verbatim", () => {
    // «Срок оплаты» is a date-kind field, but real invoices state a period. The fill
    // layer already falls back to writing unparseable date values as text
    // (lib/fill/values.ts), so flagging them here contradicted what the app does.
    for (const v of ["14 календарных дней", "5 банковских дней", "по факту поставки", "до 31.12.2026", "Июль 2026", "xx"])
      expect(isValidValue("date", v)).toBe(true);
  });
  it("empty is always valid; string/text always valid", () => {
    expect(isValidValue("amount", "")).toBe(true);
    expect(isValidValue("date", "  ")).toBe(true);
    expect(isValidValue("string", "anything")).toBe(true);
    expect(isValidValue("text", "любой текст")).toBe(true);
  });
});

describe("invalidReason", () => {
  it("names the amount rule when a number cannot be read", () => {
    for (const v of ["abc", "12ab", "1.2.3"]) expect(invalidReason("amount", v)).toBe("amount");
  });
  it("names the date rule when a date-shaped value is not a real date", () => {
    for (const v of ["31.31.2026", "2026-13-01", "45.01.2026", "31.02.2026"])
      expect(invalidReason("date", v)).toBe("date");
  });
  it("returns null for everything acceptable", () => {
    const ok: [string, string][] = [
      ["amount", "1 200,50"], ["amount", "$99"], ["amount", "-5"],
      ["date", "01.02.2026"], ["date", "2026-02-01"], ["date", "1/2/2026"],
      // Free-form terms are legitimate content for a date-kind field.
      ["date", "14 календарных дней"], ["date", "по факту поставки"],
      // Emptiness belongs to the required check, never to invalidity.
      ["amount", ""], ["date", "  "],
      // Unvalidated kinds.
      ["string", "anything"], ["text", "любой текст"],
    ];
    for (const [kind, v] of ok) expect(invalidReason(kind, v)).toBeNull();
  });
});
