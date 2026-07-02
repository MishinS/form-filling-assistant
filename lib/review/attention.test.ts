import { describe, it, expect } from "vitest";
import { attentionOf, nextAttentionIndex, type Attention } from "./attention";

describe("attentionOf", () => {
  it("flags invalid before required before low (precedence)", () => {
    expect(attentionOf({ kind: "amount", required: true, conf: "low", value: "abc" })).toBe("invalid");
    expect(attentionOf({ kind: "amount", required: true, conf: "low", value: "" })).toBe("required");
    expect(attentionOf({ kind: "string", required: false, conf: "low", value: "x" })).toBe("low");
  });
  it("returns null for a valid, filled, high-confidence field", () => {
    expect(attentionOf({ kind: "string", required: true, conf: "high", value: "ok" })).toBeNull();
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
