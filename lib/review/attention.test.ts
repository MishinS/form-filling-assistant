import { describe, it, expect } from "vitest";
import { attentionOf, nextAttentionIndex, type Attention } from "./attention";

describe("attentionOf", () => {
  it("flags invalid before required before low (precedence)", () => {
    expect(attentionOf({ kind: "amount", required: true, conf: "low", value: "abc", reviewed: false })).toBe("invalid");
    expect(attentionOf({ kind: "amount", required: true, conf: "low", value: "", reviewed: false })).toBe("required");
    expect(attentionOf({ kind: "string", required: false, conf: "low", value: "x", reviewed: false })).toBe("low");
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

describe("fields the documents cannot answer", () => {
  const f = (over: Partial<Parameters<typeof attentionOf>[0]> = {}) =>
    attentionOf({ kind: "string", required: false, conf: "low", value: "", reviewed: false, ...over });

  it("marks an empty note-sourced field as awaiting input, not as low confidence", () => {
    expect(f({ awaiting: true })).toBe("awaiting");
  });
});
