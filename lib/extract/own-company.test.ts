import { describe, it, expect } from "vitest";
import { normalizeCompany, isOwnCompany, OWN_COMPANY, findCounterparty } from "./own-company";
import type { ParsedDoc } from "@/lib/parse/types";

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

function doc(...texts: string[]): ParsedDoc {
  return {
    fileId: "f", name: "n", mime: "m", pages: 1, scannedPages: [], warnings: [],
    blocks: texts.map((text, i) => ({ text, locator: { kind: "docx", block: i } as const })),
  };
}

describe("findCounterparty", () => {
  it("returns the second company when our own company is also present", () => {
    const hit = findCounterparty([doc("Поставщик: ООО «Ромашка»", "Заказчик: АО Семейный доктор")]);
    expect(hit?.value).toContain("Ромашка");
    expect(hit?.source.fileId).toBe("f");
    expect(hit?.source.locator).toBe("блок 1");
  });

  it("returns null when only our own company appears", () => {
    expect(findCounterparty([doc("АО Семейный доктор, ИНН 7727194344")])).toBeNull();
  });

  it("returns the first of two non-own companies", () => {
    const hit = findCounterparty([doc('ООО "Альфа" и ООО "Бета"')]);
    expect(hit?.value).toContain("Альфа");
  });
});
