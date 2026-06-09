import { describe, it, expect } from "vitest";
import { normalizeCompany, isOwnCompany, OWN_COMPANY } from "./own-company";

describe("normalizeCompany", () => {
  it("strips legal form, quotes and case to a common core", () => {
    const core = "семейный доктор";
    expect(normalizeCompany("АО Семейный доктор")).toBe(core);
    expect(normalizeCompany('АО "Семейный доктор"')).toBe(core);
    expect(normalizeCompany("Акционерное общество «Семейный доктор»")).toBe(core);
    expect(normalizeCompany("ООО «Ромашка»")).toBe("ромашка");
  });
});

describe("isOwnCompany", () => {
  it("matches our company by name in various legal forms", () => {
    expect(isOwnCompany("АО Семейный доктор")).toBe(true);
    expect(isOwnCompany('АО "Семейный доктор"')).toBe(true);
    expect(isOwnCompany("Акционерное общество «Семейный доктор»")).toBe(true);
  });
  it("matches by ИНН even with a different name string", () => {
    expect(isOwnCompany(`Некто, ИНН ${OWN_COMPANY.inn}`)).toBe(true);
  });
  it("does not match a real counterparty", () => {
    expect(isOwnCompany("ООО «Ромашка»")).toBe(false);
    expect(isOwnCompany("ЗАО Лютик, ИНН 7701234567")).toBe(false);
  });
  it("returns false for empty/blank", () => {
    expect(isOwnCompany("")).toBe(false);
    expect(isOwnCompany("   ")).toBe(false);
  });
});
