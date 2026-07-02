import { describe, it, expect } from "vitest";
import { ACCENTS, DEFAULT_ACCENT, isAccentId, parseAccentId } from "./accent-core";

describe("accent-core", () => {
  it("has exactly the five locked presets with blue first and as default", () => {
    expect(ACCENTS.map((a) => a.id)).toEqual(["blue", "teal", "indigo", "plum", "rose"]);
    expect(DEFAULT_ACCENT).toBe("blue");
    expect(ACCENTS[0].id).toBe(DEFAULT_ACCENT);
  });

  it("isAccentId accepts only the five ids", () => {
    for (const a of ACCENTS) expect(isAccentId(a.id)).toBe(true);
    for (const bad of ["purple", "", undefined, null, 42]) expect(isAccentId(bad)).toBe(false);
  });

  it("parseAccentId coerces unknown/empty/null to blue", () => {
    expect(parseAccentId("teal")).toBe("teal");
    expect(parseAccentId("nope")).toBe("blue");
    expect(parseAccentId("")).toBe("blue");
    expect(parseAccentId(undefined)).toBe("blue");
    expect(parseAccentId(null)).toBe("blue");
  });
});
