import { describe, it, expect } from "vitest";
import { buildExtractionPrompt } from "./prompt";
import type { ExtractField } from "../fields";

const base: ExtractField = {
  id: "f1", group: "req", label_ru: "Контрагент", label_en: "Counterparty",
  cell: "ПТ!D9", kind: "string", required: true, strategy: "llm",
};

describe("buildExtractionPrompt", () => {
  it("includes the brevity and legal-form instructions", () => {
    const p = buildExtractionPrompt([base], "текст");
    expect(p).toContain("кратко и по существу");
    expect(p).toContain("Организационно-правовые формы");
  });

  it("renders a field hint after the kind", () => {
    const p = buildExtractionPrompt([{ ...base, hint_ru: "только форма и название" }], "текст");
    expect(p).toContain("- f1: Контрагент (string) — только форма и название");
  });

  it("renders a field without a hint as a plain line", () => {
    const p = buildExtractionPrompt([base], "текст");
    expect(p).toContain("- f1: Контрагент (string)\n");
    expect(p).not.toContain("undefined");
  });
});
