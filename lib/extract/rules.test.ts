import { describe, it, expect } from "vitest";
import { invoiceNoDate, totalAmount, currency } from "./rules";
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
  it("matches an invoice number with no adjacent date", () => {
    expect(invoiceNoDate([block("Счёт на оплату № 142")])?.value).toBe("Счёт №142");
  });
  it("matches «Договор поставки № … от …» with a qualifier word", () => {
    expect(invoiceNoDate([block("Договор поставки № 45 от 12.06.2026")])?.value).toBe(
      "Договор №45 от 12.06.2026",
    );
  });
  it("matches «Счёт-фактура №…»", () => {
    expect(invoiceNoDate([block("Счёт-фактура №СФ-99 от 03.03.2026")])?.value).toBe(
      "Счёт №СФ-99 от 03.03.2026",
    );
  });
  it("prefers an invoice over a contract when both are present", () => {
    const hit = invoiceNoDate([block("Договор №7 от 01.05.2026"), block("Счёт №142 от 20.05.2026")]);
    expect(hit?.value).toBe("Счёт №142 от 20.05.2026");
  });
  it("does not match «счёт» embedded in another word", () => {
    expect(invoiceNoDate([block("расчёт №5 произведён")])).toBeNull();
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
