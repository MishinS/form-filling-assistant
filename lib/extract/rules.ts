import type { ParsedBlock, Locator } from "@/lib/parse/types";

export interface RuleHit { value: string; locator: Locator; }
export type Rule = (blocks: ParsedBlock[]) => RuleHit | null;

// «Счёт»/«Договор» № <номер> [от <дата>]. The doc word may carry up to a few
// qualifier words before the number marker («Договор поставки №…», «Счёт на оплату №…»),
// the marker may be №/No/N/#, and the «от <дата>» tail is optional (a bare number
// still counts). A left lookbehind stops «счёт» matching inside «расчёт»/«счётчик».
const DATE = "\\d{1,2}[.\\-/]\\d{1,2}[.\\-/]\\d{2,4}";
const docNoRe = (head: string) =>
  new RegExp(
    `(?<![а-яёa-z])${head}(?:\\s+[а-яё-]+){0,3}?\\s*(?:№|no\\.?|n\\.?|#)\\s*([^\\s,;]+)(?:\\s*от\\s*(${DATE}))?`,
    "i",
  );
const RE_INVOICE = docNoRe("сч[её]т(?:-фактура|-оферта)?");
const RE_CONTRACT = docNoRe("договор[а-яё]*");

function formatDocNo(kind: "Счёт" | "Договор", num: string, date?: string): string {
  return date ? `${kind} №${num} от ${date}` : `${kind} №${num}`;
}

export const invoiceNoDate: Rule = (blocks) => {
  // Prefer an invoice (the document actually being paid) over a contract reference.
  for (const b of blocks) {
    const m = b.text.match(RE_INVOICE);
    if (m) return { value: formatDocNo("Счёт", m[1], m[2]), locator: b.locator };
  }
  for (const b of blocks) {
    const m = b.text.match(RE_CONTRACT);
    if (m) return { value: formatDocNo("Договор", m[1], m[2]), locator: b.locator };
  }
  return null;
};

const RE_AMOUNT = /(?:итого|всего|к\s+оплате|сумма\s+к\s+оплате)[^0-9]{0,20}(\d[\d  ]*(?:[.,]\d{2})?)/i;
export const totalAmount: Rule = (blocks) => {
  for (const b of blocks) {
    const m = b.text.match(RE_AMOUNT);
    if (m) return { value: normalizeAmount(m[1]), locator: b.locator };
  }
  return null;
};

const RE_CURRENCY = /(₽|руб\.?|RUB|USD|\$|EUR|€)/i;
export const currency: Rule = (blocks) => {
  for (const b of blocks) {
    const m = b.text.match(RE_CURRENCY);
    if (m) return { value: normalizeCurrency(m[1]), locator: b.locator };
  }
  return null;
};

function normalizeAmount(raw: string): string {
  const n = Number(raw.replace(/[  ]/g, "").replace(",", "."));
  if (Number.isNaN(n)) return raw.trim();
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeCurrency(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("руб") || s === "₽" || s === "rub") return "руб.";
  if (s === "$" || s === "usd") return "USD";
  if (s === "€" || s === "eur") return "EUR";
  return raw;
}

export const RULES = { invoiceNoDate, totalAmount, currency } as const;
export type RuleKey = keyof typeof RULES;
