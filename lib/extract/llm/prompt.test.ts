import { describe, it, expect } from "vitest";
import { buildExtractionPrompt } from "./prompt";
import type { ExtractField } from "../fields";
import { OWN_COMPANY } from "../own-company";

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

const FIELDS = [{ id: "f1", label_ru: "Контрагент", kind: "text" }] as any;

describe("localGuidance", () => {
  it("omits the local guidance block by default (cloud byte-for-byte)", () => {
    const p = buildExtractionPrompt(FIELDS, "текст", "JSON line");
    expect(p).not.toContain("верни КАЖДОЕ поле");
  });

  it("appends the local guidance block when localGuidance is true", () => {
    const p = buildExtractionPrompt(FIELDS, "текст", "JSON line", true);
    expect(p).toContain("верни КАЖДОЕ поле");
    expect(p).toContain(OWN_COMPANY.inn);
    expect(p).toContain("никогда не возвращай её как Контрагент");
  });
});
