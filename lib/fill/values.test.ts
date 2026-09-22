import { describe,it,expect } from "vitest";
import { planWrites,scheduleFromValues,resolveValues,type CellWrite } from "./values";
import type { ExtractedValue } from "@/lib/types";

const ev = (fieldId: string, value: string): ExtractedValue => ({
  fieldId, value, confidence: "high", source: { fileId: null, locator: "" },
});
const find = (ws: CellWrite[], sheet: string, ref: string) =>
  ws.find(w => w.sheet === sheet && w.ref === ref);

describe("planWrites", () => {
  it("writes string fields into their ПТ cells", () => {
    const ws = planWrites([ev("f1", 'ООО «Ромашка»')]);
    expect(find(ws, "ПТ", "D9")).toMatchObject({ mode: "string", value: 'ООО «Ромашка»' });
  });

  it("routes the amount (f4) through the «График оплат» schedule + ПТ formula cache", () => {
    const ws = planWrites([ev("f4", "100 000,00"), ev("f10", "30.04.2026")]);
    // amount is NOT written directly into the ПТ formula cells:
    expect(ws.find(w => w.sheet === "ПТ" && w.ref === "D13" && w.mode === "number")).toBeUndefined();
    expect(ws.find(w => w.sheet === "ПТ" && w.ref === "D15" && w.mode === "number")).toBeUndefined();
    // it lands in «График оплат» instead:
    expect(find(ws, "График оплат", "D5")).toMatchObject({ mode: "number", value: 100000 });
    expect(find(ws, "График оплат", "C5")).toMatchObject({ mode: "string", value: "100%" });
    expect(find(ws, "График оплат", "B5")).toMatchObject({ mode: "string", value: "Аванс" });
    expect(find(ws, "График оплат", "E5")).toMatchObject({ mode: "number", value: 46142 });
    // and the two ПТ formula cells get their caches refreshed:
    expect(ws.filter(w => w.mode === "formulaCache").map(w => w.ref).sort()).toEqual(["D13", "D15"]);
  });
});

import { PT_FIELDS } from "@/lib/extract/fields";

describe("planWrites with a custom field list", () => {
  const vals = (o: Record<string, string>) =>
    Object.entries(o).map(([fieldId, value]) => ({
      fieldId, value, confidence: "high" as const, source: { fileId: null, locator: "" },
    }));

  it("writes a remapped cell to the new ref", () => {
    const fields = PT_FIELDS.map(f => f.id === "f1" ? { ...f, cell: "ПТ!D10" } : f);
    const writes = planWrites(vals({ f1: "ООО Тест" }), fields);
    const w = writes.find(x => x.value === "ООО Тест");
    expect(w).toMatchObject({ sheet: "ПТ", ref: "D10", mode: "string" });
  });

  it("skips a removed field", () => {
    const fields = PT_FIELDS.filter(f => f.id !== "f1"); // drop Контрагент (ПТ!D9)
    const writes = planWrites(vals({ f1: "ООО Тест", f8: "Аванс" }), fields);
    expect(writes.find(x => x.ref === "D9")).toBeUndefined();
  });
});

import type { ExtractField } from "@/lib/extract/fields";

describe("resolveValues", () => {
  const base = (over: Partial<ExtractField>): ExtractField => ({
    id: "x", group: "req", label_ru: "L", label_en: "L", cell: "ПТ!A1",
    kind: "string", required: false, strategy: "manual", ...over,
  });
  const NOW = new Date(Date.UTC(2026, 5, 17)); // 17.06.2026

  it("константа берётся из конфига поля", () => {
    const fields = [base({ id: "f1", fillMode: "constant", constantValue: "АО Семейный доктор" })];
    const out = resolveValues(fields, [], NOW);
    expect(out).toEqual([{ fieldId: "f1", value: "АО Семейный доктор", confidence: "high", source: { fileId: null, locator: "" } }]);
  });

  it("дата вычисляется по правилу", () => {
    const fields = [base({ id: "f10", kind: "date", fillMode: "date", dateRule: { offset: "nextDay", format: "dmy" } })];
    expect(resolveValues(fields, [], NOW)[0].value).toBe("18.06.2026");
  });

  it("f9-константа прогоняется через split графика", () => {
    const fields = [
      base({ id: "f4", kind: "amount" }),
      base({ id: "f9", kind: "text", fillMode: "constant", constantValue: "Аванс 30%, постоплата 70%" }),
    ];
    const extracted = [{ fieldId: "f4", value: "100000", confidence: "high" as const, source: { fileId: null, locator: "" } }];
    const resolved = resolveValues(fields, extracted, NOW);
    const sched = scheduleFromValues(resolved);
    expect(sched?.map(r => r.percent)).toEqual([30, 70]);
  });
});
