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
