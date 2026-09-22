import { describe, it, expect } from "vitest";
import { parseFieldList } from "./validate";
import { PT_FIELDS } from "@/lib/extract/fields";

describe("parseFieldList", () => {
  it("returns the same fields for the built-in catalog", () => {
    expect(parseFieldList(PT_FIELDS)).toEqual(PT_FIELDS);
  });
  it("returns null for undefined (caller falls back to default)", () => {
    expect(parseFieldList(undefined)).toBeNull();
  });
  it("rejects a non-array", () => {
    expect(parseFieldList({ id: "f1" })).toBeNull();
  });
  it("rejects a field with a bad (non-empty) cell", () => {
    const bad = [{ ...PT_FIELDS[0], cell: "9D" }];
    expect(parseFieldList(bad)).toBeNull();
  });
  it("accepts an unmapped field with an empty cell (kept as '')", () => {
    // Local-scan templates may have fields the user has not yet mapped to a cell;
    // the editor must be able to save them (fill skips empty-cell fields).
    const out = parseFieldList([{ ...PT_FIELDS[0], cell: "" }]);
    expect(out).not.toBeNull();
    expect(out?.[0].cell).toBe("");
  });
  it("treats a whitespace-only cell as unmapped ('')", () => {
    const out = parseFieldList([{ ...PT_FIELDS[0], cell: "   " }]);
    expect(out?.[0].cell).toBe("");
  });
  it("rejects a field missing required keys", () => {
    expect(parseFieldList([{ id: "fx" }])).toBeNull();
  });
  it("normalizes a bare cell ref to the ПТ sheet", () => {
    const input = [{ ...PT_FIELDS[0], cell: "D9" }];
    expect(parseFieldList(input)?.[0].cell).toBe("ПТ!D9");
  });
  it("rejects an unknown rule key (would crash the regex pass)", () => {
    const bad = [{ ...PT_FIELDS[2], strategy: "rule", rule: "bogus" }]; // f3 is a rule field
    expect(parseFieldList(bad)).toBeNull();
  });
  it("accepts a field with no rule (rule is optional)", () => {
    const ok = parseFieldList([{ ...PT_FIELDS[0] }]); // f1 is an llm field, no rule
    expect(ok?.[0].rule).toBeUndefined();
  });

  it("carries hint_ru through (lossless round-trip)", () => {
    const f = { ...PT_FIELDS[0], hint_ru: "кратко" };
    const out = parseFieldList([f]);
    expect(out?.[0].hint_ru).toBe("кратко");
  });

  it("silently drops an over-long hint_ru but keeps the field", () => {
    const f = { ...PT_FIELDS[0], hint_ru: "x".repeat(201) };
    const out = parseFieldList([f]);
    expect(out).not.toBeNull();
    expect(out?.[0].hint_ru).toBeUndefined();
  });

  it("протаскивает fillMode/constantValue/dateRule лосслесс", () => {
    const input = [{
      id: "f8", group: "pay", label_ru: "Вид", label_en: "T", cell: "ПТ!H15",
      kind: "string", strategy: "manual", required: true,
      fillMode: "constant", constantValue: "безнал",
    }, {
      id: "f10", group: "terms", label_ru: "Срок", label_en: "Due", cell: "ПТ!H16",
      kind: "date", strategy: "manual", required: false,
      fillMode: "date", dateRule: { offset: "nextDay", format: "dmy" },
    }];
    const out = parseFieldList(input);
    expect(out?.[0].fillMode).toBe("constant");
    expect(out?.[0].constantValue).toBe("безнал");
    expect(out?.[1].dateRule).toEqual({ offset: "nextDay", format: "dmy" });
  });

  it("отклоняет fillMode:date с кривым dateRule", () => {
    const input = [{
      id: "f10", group: "terms", label_ru: "Срок", label_en: "Due", cell: "ПТ!H16",
      kind: "date", strategy: "manual", required: false,
      fillMode: "date", dateRule: { offset: "WAT", format: "dmy" },
    }];
    expect(parseFieldList(input)).toBeNull();
  });

  it("игнорирует некорректный fillMode и длинный constantValue", () => {
    const input = [{
      id: "f1", group: "req", label_ru: "K", label_en: "C", cell: "ПТ!D9",
      kind: "string", strategy: "manual", required: false,
      fillMode: "weird", constantValue: "z".repeat(600),
    }];
    const out = parseFieldList(input);
    expect(out?.[0].fillMode).toBeUndefined();
    expect(out?.[0].constantValue).toBeUndefined();
  });
});

describe("parseFieldList with allowedSheets", () => {
  it("accepts custom-sheet cells and normalizes bare refs to the first sheet", () => {
    const input = [
      { id: "f1", group: "req", label_ru: "Поставщик", label_en: "Supplier", cell: "Данные!B2", kind: "string", required: false, strategy: "llm" },
      { id: "f2", group: "req", label_ru: "Сумма", label_en: "Amount", cell: "C3", kind: "amount", required: false, strategy: "llm" },
    ];
    const out = parseFieldList(input, { allowedSheets: ["Лист1", "Данные"] });
    expect(out?.map(f => f.cell)).toEqual(["Данные!B2", "Лист1!C3"]);
  });
});

import { validateChoiceValues, parseUserNote, MAX_NOTE_LENGTH, isValueList, MAX_VALUE_LENGTH } from "./validate";
import { ED_FIELDS } from "@/lib/render/ed";

const EDSLOTS = ED_FIELDS.map((f) => f.cell);
const edField = (over: Record<string, unknown> = {}) => ({
  id: "e2", group: "order", label_ru: "Предмет", label_en: "Subject",
  kind: "text", required: true, strategy: "llm", cell: "subject", ...over,
});

describe("parseFieldList picks its address validator from the template format", () => {
  const opts = { format: "html" as const, allowedSlots: EDSLOTS, allowedGroups: ["order", "terms", "sign"] };

  it("accepts a slot the skeleton declares", () => {
    expect(parseFieldList([edField()], opts)?.[0].cell).toBe("subject");
  });

  it("rejects a spreadsheet cell reference on an HTML template", () => {
    expect(parseFieldList([edField({ cell: "ПТ!D9" })], opts)).toBeNull();
  });

  it("rejects a slot the skeleton does not declare", () => {
    expect(parseFieldList([edField({ cell: "nosuchslot" })], opts)).toBeNull();
  });

  it("rejects a slot name on an XLSX template", () => {
    expect(parseFieldList([{ ...PT_FIELDS[0], cell: "subject" }])).toBeNull();
  });

  it("rejects a group the template does not declare", () => {
    expect(parseFieldList([edField({ group: "pay" })], opts)).toBeNull();
  });

  it("never carries render markup in from a request body", () => {
    const hostile = edField({
      paragraphHtml: '<p onclick="steal()">{}</p>',
      listSeparator: "<script>alert(1)</script>",
      slotMode: "paragraphs",
    });
    const out = parseFieldList([hostile], opts);
    expect(out).not.toBeNull();
    expect(out![0].paragraphHtml).toBeUndefined();
    expect(out![0].listSeparator).toBeUndefined();
  });
});

describe("choice values", () => {
  it("accepts a value from the field's own list", () => {
    expect(validateChoiceValues(ED_FIELDS, [{ fieldId: "e11", value: "Суровцев" }])).toBe(true);
  });

  it("accepts an empty value — the person simply has not chosen yet", () => {
    expect(validateChoiceValues(ED_FIELDS, [{ fieldId: "e11", value: "" }])).toBe(true);
  });

  it("rejects a value outside the list", () => {
    expect(validateChoiceValues(ED_FIELDS, [{ fieldId: "e11", value: "Иванов" }])).toBe(false);
  });

  it("ignores fields that are not choices", () => {
    expect(validateChoiceValues(ED_FIELDS, [{ fieldId: "e2", value: "что угодно" }])).toBe(true);
  });
});

describe("the run note", () => {
  it("accepts an absent note", () => {
    expect(parseUserNote(undefined)).toEqual({ ok: true, note: "" });
  });

  it("trims and keeps a normal note", () => {
    expect(parseUserNote("  проект 1905  ")).toEqual({ ok: true, note: "проект 1905" });
  });

  it("rejects a note that is not text", () => {
    expect(parseUserNote({ evil: true })).toEqual({ ok: false });
    expect(parseUserNote(42)).toEqual({ ok: false });
  });

  it("rejects an oversized note rather than truncating it", () => {
    expect(parseUserNote("x".repeat(MAX_NOTE_LENGTH + 1))).toEqual({ ok: false });
  });

  it("accepts a note exactly at the bound", () => {
    const note = "x".repeat(MAX_NOTE_LENGTH);
    expect(parseUserNote(note)).toEqual({ ok: true, note });
  });
});

describe("value shape", () => {
  it("accepts a normal value list", () => {
    expect(isValueList([{ fieldId: "e2", value: "мебель" }])).toBe(true);
  });
  it("accepts an empty list", () => {
    expect(isValueList([])).toBe(true);
  });
  it("rejects a non-string value — trim() on a number is a 500, not a 400", () => {
    expect(isValueList([{ fieldId: "e2", value: 5 }])).toBe(false);
  });
  it("rejects a null entry", () => {
    expect(isValueList([null])).toBe(false);
  });
  it("rejects a missing fieldId", () => {
    expect(isValueList([{ value: "x" }])).toBe(false);
  });
  it("rejects anything that is not an array", () => {
    expect(isValueList({ fieldId: "e2", value: "x" })).toBe(false);
    expect(isValueList(undefined)).toBe(false);
  });
  it("rejects an oversized value", () => {
    expect(isValueList([{ fieldId: "e2", value: "x".repeat(MAX_VALUE_LENGTH + 1) }])).toBe(false);
  });
});
