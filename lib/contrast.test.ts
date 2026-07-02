import { describe, it, expect } from "vitest";
import { contrastText } from "./contrast";
import { ACCENTS } from "./accent-core";

describe("contrastText", () => {
  it("returns light text on the dark blue accent", () => {
    expect(contrastText("#0b5394")).toBe("#f1f3f0");
  });
  it("returns dark text on a light surface", () => {
    expect(contrastText("#f1f3f0")).toBe("#0b0f0e");
  });
  it("keeps light text (#f1f3f0) readable on every accent preset", () => {
    for (const a of ACCENTS) expect(contrastText(a.hex)).toBe("#f1f3f0");
  });
});
