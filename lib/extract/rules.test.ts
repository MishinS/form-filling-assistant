import { describe, it, expect } from "vitest";
import { invoiceNoDate, totalAmount, currency } from "./rules";
import type { ParsedBlock } from "@/lib/parse/types";

const block = (text: string): ParsedBlock => ({ text, locator: { kind: "pdf", page: 1 } });

describe("invoiceNoDate", () => {
  it("matches «Счёт № … от …» and carries the block locator", () => {
    const hit = invoiceNoDate([block("Счёт-оферта №201 от 16.04.2026 на оплату")]);
    expect(hit).toEqual({ value: "Счёт №201 от 16.04.2026", locator: { kind: "pdf", page: 1 } });
  });
  it("returns null when absent", () => {
    expect(invoiceNoDate([block("нет реквизитов")])).toBeNull();
  });
});

describe("totalAmount", () => {
  it("extracts and normalizes the total", () => {
    expect(totalAmount([block("Итого к оплате: 418 600,00 руб.")])?.value).toBe("418 600,00");
  });
});

describe("currency", () => {
  it("normalizes rouble variants", () => {
    expect(currency([block("Сумма 100 ₽")])?.value).toBe("руб.");
    expect(currency([block("USD 100")])?.value).toBe("USD");
  });
});
