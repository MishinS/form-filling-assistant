import { describe, it, expect } from "vitest";
import { validateCellRef } from "./cellref";

describe("validateCellRef", () => {
  it("accepts a bare ref and normalizes to the ПТ sheet", () => {
    expect(validateCellRef("D9")).toEqual({ ok: true, normalized: "ПТ!D9" });
  });
  it("accepts an explicit ПТ-prefixed ref", () => {
    expect(validateCellRef("ПТ!H16")).toEqual({ ok: true, normalized: "ПТ!H16" });
  });
  it("lowercases-insensitively rejects nothing valid: multi-letter columns ok", () => {
    expect(validateCellRef("AB12")).toEqual({ ok: true, normalized: "ПТ!AB12" });
  });
  it("rejects an empty string", () => {
    expect(validateCellRef("  ")).toEqual({ ok: false, reason: "empty" });
  });
  it("rejects a malformed ref", () => {
    expect(validateCellRef("9D")).toEqual({ ok: false, reason: "format" });
  });
  it("rejects a non-ПТ sheet", () => {
    expect(validateCellRef("Счёт!A1")).toEqual({ ok: false, reason: "sheet" });
  });
});

describe("validateCellRef with allowedSheets", () => {
  it("accepts a listed sheet and normalizes", () => {
    expect(validateCellRef("Данные!B2", ["Лист1", "Данные"])).toEqual({ ok: true, normalized: "Данные!B2" });
  });
  it("prefixes a bare ref with the first sheet", () => {
    expect(validateCellRef("A1", ["Лист1", "Данные"])).toEqual({ ok: true, normalized: "Лист1!A1" });
  });
  it("rejects an unknown sheet", () => {
    expect(validateCellRef("Чужой!A1", ["Лист1"])).toEqual({ ok: false, reason: "sheet" });
  });
  it("keeps the ПТ default when allowedSheets is omitted", () => {
    expect(validateCellRef("D9")).toEqual({ ok: true, normalized: "ПТ!D9" });
    expect(validateCellRef("Лист1!A1")).toEqual({ ok: false, reason: "sheet" });
  });
});
