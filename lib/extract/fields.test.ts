import { describe, it, expect } from "vitest";
import { PT_FIELDS, PT_GROUPS, SCHEDULE_LOCKED_FIELDS, isCellLocked, newManualField } from "./fields";

describe("PT_FIELDS catalog", () => {
  it("has 12 fields with unique ids", () => {
    expect(PT_FIELDS).toHaveLength(12);
    expect(new Set(PT_FIELDS.map(f => f.id)).size).toBe(12);
  });
  it("splits strategies 4 rule / 6 llm / 2 manual", () => {
    const by = (s: string) => PT_FIELDS.filter(f => f.strategy === s).length;
    expect(by("rule")).toBe(4);
    expect(by("llm")).toBe(6);
    expect(by("manual")).toBe(2);
  });
  it("every rule field names a rule, every group exists", () => {
    const groups = new Set(PT_GROUPS.map(g => g.id));
    for (const f of PT_FIELDS) {
      expect(groups.has(f.group)).toBe(true);
      if (f.strategy === "rule") expect(f.rule).toBeTruthy();
    }
  });
});

describe("mapping helpers", () => {
  it("locks the schedule-driven amount fields", () => {
    expect(SCHEDULE_LOCKED_FIELDS).toEqual(["f4", "f7"]);
    expect(isCellLocked("f4")).toBe(true);
    expect(isCellLocked("f7")).toBe(true);
    expect(isCellLocked("f1")).toBe(false);
  });

  it("creates a manual field with the next free fN id", () => {
    const f = newManualField(PT_FIELDS, { label_ru: "Тест", label_en: "Test", kind: "string", cell: "ПТ!D20" });
    expect(f.id).toBe("f13");
    expect(f.strategy).toBe("manual");
    expect(f.group).toBe("req");
    expect(f.required).toBe(false);
    expect(f.cell).toBe("ПТ!D20");
    expect(f.kind).toBe("string");
  });

  it("does not collide when fN ids already exist beyond the catalog", () => {
    const extended = [...PT_FIELDS, { ...PT_FIELDS[0], id: "f20" }];
    expect(newManualField(extended, { label_ru: "x", label_en: "x", kind: "date", cell: "" }).id).toBe("f21");
  });
});
