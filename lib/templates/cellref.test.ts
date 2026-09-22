import { describe, it, expect } from "vitest";
import { validateCellRef } from "./cellref";

describe("validateCellRef", () => {
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
});
