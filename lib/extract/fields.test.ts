import { describe, it, expect } from "vitest";
import { PT_FIELDS, PT_GROUPS } from "./fields";

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
