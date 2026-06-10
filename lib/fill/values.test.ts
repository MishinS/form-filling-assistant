import { describe, it, expect } from "vitest";
import { planWrites, sheetFile, scheduleFromValues, type CellWrite } from "./values";
import type { ExtractedValue } from "@/lib/types";

const ev = (fieldId: string, value: string): ExtractedValue => ({
  fieldId, value, confidence: "high", source: { fileId: null, locator: "" },
});
const find = (ws: CellWrite[], sheet: string, ref: string) =>
  ws.find(w => w.sheet === sheet && w.ref === ref);

describe("sheetFile", () => {
  it("maps sheet names to worksheet XML paths", () => {
    expect(sheetFile("ПТ")).toBe("xl/worksheets/sheet1.xml");
    expect(sheetFile("График оплат")).toBe("xl/worksheets/sheet3.xml");
    expect(() => sheetFile("nope")).toThrow();
  });
});

describe("planWrites", () => {
  it("writes string fields into their ПТ cells", () => {
    const ws = planWrites([ev("f1", 'ООО «Ромашка»')]);
    expect(find(ws, "ПТ", "D9")).toMatchObject({ mode: "string", value: 'ООО «Ромашка»' });
  });

  it("writes f10 срок into ПТ!H16 as a date serial", () => {
    const ws = planWrites([ev("f10", "30.04.2026")]);
    expect(find(ws, "ПТ", "H16")).toMatchObject({ mode: "number", value: 46142 });
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

  it("skips empty values (manual fields left as template default)", () => {
    const ws = planWrites([ev("f1", "  "), ev("f6", "")]);
    expect(ws).toHaveLength(0);
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

  it("writes a new manual field to its cell", () => {
    const fields = [
      ...PT_FIELDS,
      { id: "f13", group: "req" as const, label_ru: "Доп", label_en: "Extra",
        cell: "ПТ!D22", kind: "string" as const, required: false, strategy: "manual" as const },
    ];
    const writes = planWrites(vals({ f13: "примечание" }), fields);
    expect(writes.find(x => x.ref === "D22")).toMatchObject({ mode: "string", value: "примечание" });
  });

  it("skips a removed field", () => {
    const fields = PT_FIELDS.filter(f => f.id !== "f1"); // drop Контрагент (ПТ!D9)
    const writes = planWrites(vals({ f1: "ООО Тест", f8: "Аванс" }), fields);
    expect(writes.find(x => x.ref === "D9")).toBeUndefined();
  });

  it("defaults to PT_FIELDS when no list is passed", () => {
    const writes = planWrites(vals({ f1: "ООО Тест" }));
    expect(writes.find(x => x.ref === "D9")).toMatchObject({ mode: "string", value: "ООО Тест" });
  });
});

describe("planWrites with a 30/70 split in f9", () => {
  const ws = planWrites([
    ev("f4", "100 000,00"),
    ev("f9", "аванс 30%, постоплата 70%"),
    ev("f10", "30.04.2026"),
  ]);

  it("writes both schedule rows (5 and 6) with №, stage, percent, amount", () => {
    expect(find(ws, "График оплат", "D5")).toMatchObject({ mode: "number", value: 30000 });
    expect(find(ws, "График оплат", "B5")).toMatchObject({ mode: "string", value: "Аванс" });
    expect(find(ws, "График оплат", "C5")).toMatchObject({ mode: "string", value: "30%" });
    expect(find(ws, "График оплат", "A5")).toBeUndefined(); // A5=1 уже в шаблоне
    expect(find(ws, "График оплат", "A6")).toMatchObject({ mode: "number", value: 2 });
    expect(find(ws, "График оплат", "B6")).toMatchObject({ mode: "string", value: "Постоплата" });
    expect(find(ws, "График оплат", "C6")).toMatchObject({ mode: "string", value: "70%" });
    expect(find(ws, "График оплат", "D6")).toMatchObject({ mode: "number", value: 70000 });
  });

  it("writes no dues when split and blanks the template sample date in E5", () => {
    // E5 в образце содержит образцовую дату (46162) — при разбивке её надо затереть пустой строкой
    expect(find(ws, "График оплат", "E5")).toMatchObject({ mode: "string", value: "" });
    expect(find(ws, "График оплат", "E6")).toBeUndefined();
    expect(find(ws, "ПТ", "H16")).toMatchObject({ mode: "number", value: 46142 }); // сам f10 в ПТ остаётся
  });

  it("caches D13=total and D15=advance amount", () => {
    expect(find(ws, "ПТ", "D13")).toMatchObject({ mode: "formulaCache", value: 100000 });
    expect(find(ws, "ПТ", "D15")).toMatchObject({ mode: "formulaCache", value: 30000 });
  });
});

describe("scheduleFromValues", () => {
  it("builds the schedule from f4/f9/f10", () => {
    const rows = scheduleFromValues([ev("f4", "100 000,00"), ev("f9", "аванс 30%, постоплата 70%")]);
    expect(rows?.map(r => r.amount)).toEqual([30000, 70000]);
  });
  it("returns null without a total", () => {
    expect(scheduleFromValues([ev("f9", "аванс 30%")])).toBeNull();
  });
  it("keeps the single-row legacy schedule without f9", () => {
    const rows = scheduleFromValues([ev("f4", "100 000,00"), ev("f10", "30.04.2026")]);
    expect(rows).toEqual([{ stage: "Аванс", percent: 100, amount: 100000, due: 46142 }]);
  });
});
