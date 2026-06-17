import type { FieldKind } from "@/lib/types";
import type { RuleKey } from "./rules";

export type Strategy = "rule" | "llm" | "manual";

export interface ExtractField {
  id: string;
  group: "req" | "pay" | "terms";
  label_ru: string;
  label_en: string;
  cell: string;
  kind: FieldKind;
  unit?: string;
  area?: boolean;
  required: boolean;
  strategy: Strategy;
  rule?: RuleKey;
  /** Field that holds the counterparty — subject to the own-company post-filter. */
  isCounterparty?: boolean;
  /** Подсказка LLM по стилю/формату значения; попадает в строку поля в промпте. */
  hint_ru?: string;
}

export const PT_FIELDS: ExtractField[] = [
  { id: "f1",  group: "req",   label_ru: "Контрагент",                   label_en: "Counterparty",                 cell: "ПТ!D9",  kind: "string", required: true,  strategy: "llm", isCounterparty: true, hint_ru: 'только форма и название, например: ООО "Ромашка"' },
  { id: "f2",  group: "req",   label_ru: "Основание платежа",            label_en: "Payment basis",                cell: "ПТ!D11", kind: "text",   required: true,  strategy: "llm", area: true, hint_ru: "полное связное наименование закупаемого с обоснованием, законченной фразой" },
  { id: "f3",  group: "req",   label_ru: "Договор / Счёт №, дата",        label_en: "Contract / Invoice no., date", cell: "ПТ!D12", kind: "string", required: true,  strategy: "rule", rule: "invoiceNoDate" },
  { id: "f4",  group: "pay",   label_ru: "Сумма по договору",            label_en: "Contract amount",              cell: "ПТ!D13", kind: "amount", unit: "руб.", required: true,  strategy: "rule", rule: "totalAmount" },
  { id: "f5",  group: "pay",   label_ru: "Валюта",                       label_en: "Currency",                     cell: "ПТ!F13", kind: "string", required: true,  strategy: "rule", rule: "currency" },
  { id: "f6",  group: "pay",   label_ru: "Уже оплачено",                 label_en: "Already paid",                 cell: "ПТ!D14", kind: "amount", unit: "руб.", required: false, strategy: "manual" },
  { id: "f7",  group: "pay",   label_ru: "Сумма текущей оплаты",         label_en: "Current payment",              cell: "ПТ!D15", kind: "amount", unit: "руб.", required: true,  strategy: "rule", rule: "totalAmount" },
  { id: "f8",  group: "pay",   label_ru: "Вид платежа",                  label_en: "Payment type",                 cell: "ПТ!H15", kind: "string", required: true,  strategy: "llm" },
  { id: "f9",  group: "terms", label_ru: "Условия оплаты по договору",   label_en: "Payment terms",                cell: "ПТ!D16", kind: "text",   required: true,  strategy: "llm", area: true, hint_ru: 'только этапы и проценты, например: "Аванс 100%" или "Аванс 30%, постоплата 70%"; без сроков в днях' },
  { id: "f10", group: "terms", label_ru: "Срок оплаты",                  label_en: "Payment due",                  cell: "ПТ!H16", kind: "date",   required: false, strategy: "llm" },
  { id: "f11", group: "terms", label_ru: "Условия поставки по договору", label_en: "Delivery terms",               cell: "ПТ!D19", kind: "text",   required: true,  strategy: "llm", area: true, hint_ru: 'кратко срок, например: "30 раб. дней"' },
  { id: "f12", group: "terms", label_ru: "Дата получения документов",    label_en: "Documents received",           cell: "ПТ!D21", kind: "date",   required: false, strategy: "manual" },
];

export const PT_GROUPS = [
  { id: "req",   ru: "Реквизиты", en: "Details" },
  { id: "pay",   ru: "Платёж",    en: "Payment" },
  { id: "terms", ru: "Условия",   en: "Terms" },
] as const;

/** Amount fields whose cells (ПТ!D13/D15) are driven by «График оплат» formulas — cell is not editable. */
export const SCHEDULE_LOCKED_FIELDS = ["f4", "f7"] as const;

export function isCellLocked(fieldId: string): boolean {
  return (SCHEDULE_LOCKED_FIELDS as readonly string[]).includes(fieldId);
}

/** ПТ cells reserved by «График оплат» formulas (f4→D13, f7→D15). Remapping any
 *  OTHER field onto them would overwrite the schedule formula — blocked in the editor. */
export const SCHEDULE_LOCKED_CELLS = ["ПТ!D13", "ПТ!D15"] as const;

/** True if a normalized ПТ cell ref is one of the schedule-formula cells. */
export function isReservedCell(normalizedCell: string): boolean {
  return (SCHEDULE_LOCKED_CELLS as readonly string[]).includes(normalizedCell);
}

/** Build a new manual field with the next free `fN` id, given the current field list. */
export function newManualField(
  existing: ExtractField[],
  init: { label_ru: string; label_en: string; kind: FieldKind; cell: string },
): ExtractField {
  let max = 0;
  for (const f of existing) {
    const m = f.id.match(/^f(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return {
    id: `f${max + 1}`,
    group: "req",
    label_ru: init.label_ru,
    label_en: init.label_en,
    cell: init.cell,
    kind: init.kind,
    required: false,
    strategy: "manual",
  };
}
