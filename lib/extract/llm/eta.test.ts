import { describe, it, expect } from "vitest";
import { estimateLocalMs } from "./eta";

describe("estimateLocalMs", () => {
  it("is monotonic in prompt length", () => {
    expect(estimateLocalMs("x".repeat(6000))).toBeGreaterThan(estimateLocalMs("x".repeat(600)));
  });
  it("returns the base estimate for empty input", () => {
    expect(estimateLocalMs("")).toBe(20000);
  });
  it("clamps to the ceiling for huge input", () => {
    expect(estimateLocalMs("x".repeat(100000))).toBe(290000);
  });
});
