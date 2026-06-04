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
});
