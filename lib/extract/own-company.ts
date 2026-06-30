import type { ParsedDoc } from "@/lib/parse/types";
import type { ExtractedValue } from "@/lib/types";
import { locatorRu } from "./format";

export interface OwnCompany {
  name: string;
  inn: string;
}

/** Our company — excluded from counterparty extraction. Single source of truth. */
export const OWN_COMPANY: OwnCompany = {
  name: "АО Семейный доктор",
  inn: "7727194344",
};

// Longest forms first so "акционерное общество" is removed before bare "ао".
const LEGAL_FORMS = [
  "общество с ограниченной ответственностью",
  "публичное акционерное общество",
  "закрытое акционерное общество",
  "открытое акционерное общество",
  "акционерное общество",
  "индивидуальный предприниматель",
  "ооо",
  "пао",
  "зао",
  "оао",
  "ао",
  "ип",
];

// A "letter" for boundary purposes — Latin + Cyrillic + digits. JS `\b` only
// recognises ASCII `\w`, so it never fires inside all-Cyrillic text; we emulate a
// word boundary with lookarounds against this class instead.
const LETTER = "a-zа-яё0-9";

/** Lowercase, drop quotes and legal form, collapse whitespace → the name "core". */
export function normalizeCompany(s: string): string {
  let r = s.toLowerCase().replace(/["«»'`]/g, " ");
  for (const form of LEGAL_FORMS) {
    r = r.replace(new RegExp(`(?<![${LETTER}])${form}(?![${LETTER}])`, "g"), " ");
  }
  return r.replace(/\s+/g, " ").trim();
}

/** True if `value` names our own company — by normalized name core or by ИНН digits. */
export function isOwnCompany(value: string): boolean {
  if (!value || !value.trim()) return false;
  const core = normalizeCompany(OWN_COMPANY.name);
  if (core && normalizeCompany(value).includes(core)) return true;
  const digits = value.replace(/\D/g, "");
  if (OWN_COMPANY.inn && digits.includes(OWN_COMPANY.inn)) return true;
  return false;
}

// Legal form immediately followed by a quoted or bare company name. The `u`/`g`
// flags + an explicit alternation (longest forms first) avoid the ASCII-only `\b`
// problem; names are bounded by quotes or punctuation/newline.
const COUNTERPARTY_RE =
  /(ООО|ПАО|ЗАО|ОАО|АО|ИП)\s*(?:[«"]\s*([^«»"\n]{2,100}?)\s*[»"]|([А-ЯЁA-Z][^\n,.;:]{1,80}))/gu;

/** First company in the document that is NOT our own company, in the f1
 *  "<legal form> <name>" shape, with its source locator. `null` if none. */
export function findCounterparty(docs: ParsedDoc[]): { value: string; source: ExtractedValue["source"] } | null {
  for (const d of docs) {
    for (const b of d.blocks) {
      COUNTERPARTY_RE.lastIndex = 0; // reuse across iterations (g flag is stateful)
      let m: RegExpExecArray | null;
      while ((m = COUNTERPARTY_RE.exec(b.text)) !== null) {
        const form = m[1];
        const name = (m[2] ?? m[3] ?? "").trim();
        if (!name) continue;
        const value = m[2] ? `${form} «${name}»` : `${form} ${name}`;
        if (isOwnCompany(value)) continue;
        return { value, source: { fileId: d.fileId, locator: locatorRu(b.locator) } };
      }
    }
  }
  return null;
}
