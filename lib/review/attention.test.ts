import { describe, it, expect } from "vitest";
import { attentionOf, nextAttentionIndex, type Attention } from "./attention";

describe("attentionOf", () => {
  it("flags invalid before required before low (precedence)", () => {
    expect(attentionOf({ kind: "amount", required: true, conf: "low", value: "abc", reviewed: false })).toBe("invalid");
    expect(attentionOf({ kind: "amount", required: true, conf: "low", value: "", reviewed: false })).toBe("required");
    expect(attentionOf({ kind: "string", required: false, conf: "low", value: "x", reviewed: false })).toBe("low");
  });
  it("returns null for a valid, filled, high-confidence field", () => {
    expect(attentionOf({ kind: "string", required: true, conf: "high", value: "ok", reviewed: false })).toBeNull();
  });
  it("clears low once the row is reviewed", () => {
    const row = { kind: "string", required: false, conf: "low" as const, value: "x" };
    expect(attentionOf({ ...row, reviewed: false })).toBe("low");
    expect(attentionOf({ ...row, reviewed: true })).toBeNull();
  });
  it("does not let reviewed mask the live flags", () => {
    // Emptying a required field re-flags it even after the user reviewed it.
    expect(attentionOf({ kind: "string", required: true, conf: "low", value: "", reviewed: true })).toBe("required");
    // So does typing an unparseable amount.
    expect(attentionOf({ kind: "amount", required: false, conf: "low", value: "1.2.3", reviewed: true })).toBe("invalid");
  });
});

describe("nextAttentionIndex", () => {
  const rows = (a: Attention[]) => a.map((attention) => ({ attention }));
  it("finds the next flagged row and wraps", () => {
    const r = rows([null, "low", null, "invalid"]);
    expect(nextAttentionIndex(r, -1)).toBe(1);
    expect(nextAttentionIndex(r, 1)).toBe(3);
    expect(nextAttentionIndex(r, 3)).toBe(1); // wraps
  });
  it("returns -1 when nothing is flagged", () => {
    expect(nextAttentionIndex(rows([null, null]), -1)).toBe(-1);
  });
});

describe("nextAttentionIndex as the navigation cursor", () => {
  const rows = (a: Attention[]) => a.map((attention) => ({ attention }));

  it("walks every flagged row instead of repeating the first (the reported bug)", () => {
    const r = rows([null, "low", null, "required", "invalid"]);
    // A cursor that advances visits each flagged row once, then wraps.
    const visited: number[] = [];
    let cursor = -1;
    for (let i = 0; i < 4; i++) {
      cursor = nextAttentionIndex(r, cursor);
      visited.push(cursor);
    }
    expect(visited).toEqual([1, 3, 4, 1]);
    // The old behaviour — a hardcoded -1 every time — never leaves the first row.
    expect([-1, -1, -1].map((c) => nextAttentionIndex(r, c))).toEqual([1, 1, 1]);
  });
});
