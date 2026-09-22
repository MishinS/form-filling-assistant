import { describe, it, expect } from "vitest";
import { outputKindOf, workbookName } from "./done-core";
import { noteState, NOTE_LIMIT } from "./note-core";
import type { ExtractedValue } from "@/lib/types";

const ev = (fieldId: string, value: string): ExtractedValue =>
  ({ fieldId, value, confidence: "high", source: { fileId: null, locator: "" } });

describe("outputKindOf", () => {
  it("gives the order passport as text to paste", () => {
    expect(outputKindOf("ed")).toBe("html");
  });
  it("keeps the payment request a workbook", () => {
    expect(outputKindOf("pt")).toBe("workbook");
  });
  it("treats a user template as a workbook", () => {
    expect(outputKindOf("tpl-abc123")).toBe("workbook");
  });
});

describe("workbookName", () => {
  it("carries the counterparty into the file name", () => {
    expect(workbookName([ev("f1", "ООО Ромашка")])).toBe("ПТ_ООО Ромашка_Ф15.xlsx");
  });
  it("drops characters a file system refuses", () => {
    expect(workbookName([ev("f1", 'ООО "А/Б"')])).toBe("ПТ_ООО А Б_Ф15.xlsx".replace(" Б", "Б"));
  });
  it("falls back to the bare form name", () => {
    expect(workbookName([])).toBe("ПТ_Ф15.xlsx");
  });
});

describe("noteState", () => {
  it("trims what goes into the request", () => {
    expect(noteState("  проект 1905  ").value).toBe("проект 1905");
  });
  it("reports an empty note as nothing to send", () => {
    expect(noteState("   ").value).toBe("");
  });
  it("counts what is left", () => {
    expect(noteState("abc").left).toBe(NOTE_LIMIT - 3);
  });
  it("flags an overlong note instead of cutting it", () => {
    const s = noteState("x".repeat(NOTE_LIMIT + 5));
    expect(s.tooLong).toBe(true);
    expect(s.value.length).toBe(NOTE_LIMIT + 5);
  });
});
