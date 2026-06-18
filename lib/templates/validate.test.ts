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
  it("rejects a field with a bad cell", () => {
    const bad = [{ ...PT_FIELDS[0], cell: "9D" }];
    expect(parseFieldList(bad)).toBeNull();
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
    const out = parseFieldList(input, ["Лист1", "Данные"]);
    expect(out?.map(f => f.cell)).toEqual(["Данные!B2", "Лист1!C3"]);
  });
});
