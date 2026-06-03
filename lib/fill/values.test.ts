import { describe, it, expect } from "vitest";
import { planWrites, sheetFile, type CellWrite } from "./values";
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
