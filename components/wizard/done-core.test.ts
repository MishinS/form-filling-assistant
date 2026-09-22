import { describe,it,expect } from "vitest";
import { outputKindOf } from "./done-core";
import { noteState,NOTE_LIMIT } from "./note-core";

describe("outputKindOf", () => {
  it("gives the order passport as text to paste", () => {
    expect(outputKindOf("ed")).toBe("html");
  });
});

describe("noteState", () => {
  it("flags an overlong note instead of cutting it", () => {
    const s = noteState("x".repeat(NOTE_LIMIT + 5));
    expect(s.tooLong).toBe(true);
    expect(s.value.length).toBe(NOTE_LIMIT + 5);
  });
});
