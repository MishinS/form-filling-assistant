import { describe,it,expect } from "vitest";
import { isOwnCompany,OWN_COMPANY,findCounterparty } from "./own-company";
import type { ParsedDoc } from "@/lib/parse/types";

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
});
