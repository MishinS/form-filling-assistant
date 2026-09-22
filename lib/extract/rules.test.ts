import { describe,it,expect } from "vitest";
import { invoiceNoDate,totalAmount } from "./rules";
import type { ParsedBlock } from "@/lib/parse/types";

const block = (text: string): ParsedBlock => ({ text, locator: { kind: "pdf", page: 1 } });

describe("invoiceNoDate", () => {
  it("matches «Счёт № … от …» and carries the block locator", () => {
    const hit = invoiceNoDate([block("Счёт-оферта №201 от 16.04.2026 на оплату")]);
    expect(hit).toEqual({ value: "Счёт №201 от 16.04.2026", locator: { kind: "pdf", page: 1 } });
  });
  it("matches «Договор № … от …»", () => {
    expect(invoiceNoDate([block("Договор №7 от 01.05.2026")])?.value).toBe("Договор №7 от 01.05.2026");
  });
  it("prefers an invoice over a contract when both are present", () => {
    const hit = invoiceNoDate([block("Договор №7 от 01.05.2026"), block("Счёт №142 от 20.05.2026")]);
    expect(hit?.value).toBe("Счёт №142 от 20.05.2026");
  });
  it("does not match «счёт» embedded in another word", () => {
    expect(invoiceNoDate([block("расчёт №5 произведён")])).toBeNull();
  });
});

describe("totalAmount", () => {
  it("extracts and normalizes the total", () => {
    expect(totalAmount([block("Итого к оплате: 418 600,00 руб.")])?.value).toBe("418 600,00");
  });
});
