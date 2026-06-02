import type { ParsedBlock, Locator } from "@/lib/parse/types";

export interface RuleHit { value: string; locator: Locator; }
export type Rule = (blocks: ParsedBlock[]) => RuleHit | null;

const RE_INVOICE = /сч[её]т(?:-оферта|\s+на\s+оплату)?\s*№\s*([^\s,]+)\s*от\s*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/i;
export const invoiceNoDate: Rule = (blocks) => {
  for (const b of blocks) {
    const m = b.text.match(RE_INVOICE);
    if (m) return { value: `Счёт №${m[1]} от ${m[2]}`, locator: b.locator };
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
