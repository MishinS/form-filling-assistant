import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildExtractionPrompt } from "./prompt";
import type { ExtractField } from "../fields";
import { PT_FIELDS, PT_INSTRUCTION } from "../fields";
import { OWN_COMPANY } from "../own-company";
import { ED_INSTRUCTION, ED_FIELDS } from "@/lib/render/ed";

const base: ExtractField = {
  id: "f1", group: "req", label_ru: "Контрагент", label_en: "Counterparty",
  cell: "ПТ!D9", kind: "string", required: true, strategy: "llm",
};

describe("buildExtractionPrompt", () => {
  it("includes the brevity and legal-form instructions", () => {
    const p = buildExtractionPrompt({ fields: [base], text: "текст" });
    expect(p).toContain("кратко и по существу");
    expect(p).toContain("Организационно-правовые формы");
  });

  it("renders a field hint after the kind", () => {
    const p = buildExtractionPrompt({ fields: [{ ...base, hint_ru: "только форма и название" }], text: "текст" });
    expect(p).toContain("- f1: Контрагент (string) — только форма и название");
  });

  it("renders a field without a hint as a plain line", () => {
    const p = buildExtractionPrompt({ fields: [base], text: "текст" });
    expect(p).toContain("- f1: Контрагент (string)\n");
    expect(p).not.toContain("undefined");
  });
});

const FIELDS: ExtractField[] = [{ ...base, id: "f1", label_ru: "Контрагент", kind: "text" }];

describe("localGuidance", () => {
  it("omits the local guidance block by default (cloud byte-for-byte)", () => {
    const p = buildExtractionPrompt({ fields: FIELDS, text: "текст", jsonFormatLine: "JSON line" });
    expect(p).not.toContain("верни КАЖДОЕ поле");
  });

  it("appends the local guidance block when localGuidance is true", () => {
    const p = buildExtractionPrompt({
      fields: FIELDS, text: "текст", jsonFormatLine: "JSON line", localGuidance: true,
    });
    expect(p).toContain("верни КАЖДОЕ поле");
    expect(p).toContain(OWN_COMPANY.inn);
    expect(p).toContain("никогда не возвращай её как Контрагент");
  });
});

describe("the template owns its instruction", () => {
  it("opens with the template's instruction", () => {
    const p = buildExtractionPrompt({ fields: FIELDS, text: "текст", instruction: "ИНСТРУКЦИЯ ШАБЛОНА" });
    expect(p.startsWith("ИНСТРУКЦИЯ ШАБЛОНА")).toBe(true);
  });

  it("names no document kind when the template carries no instruction", () => {
    const p = buildExtractionPrompt({ fields: FIELDS, text: "текст" });
    expect(p).not.toContain("Платёжного требования");
    expect(p).not.toContain("Паспорт Заказа");
  });

  it("sends one template's instruction and not another's", () => {
    const pt = buildExtractionPrompt({ fields: PT_FIELDS, text: "текст", instruction: PT_INSTRUCTION });
    const ed = buildExtractionPrompt({ fields: ED_FIELDS, text: "текст", instruction: ED_INSTRUCTION });
    expect(pt).toContain("Платёжного требования");
    expect(pt).not.toContain("Паспорт Заказа");
    expect(ed).toContain("Паспорт Заказа");
    expect(ed).not.toContain("Платёжного требования");
  });
});

describe("the run note", () => {
  it("appears under its own heading, marked as the user's context", () => {
    const p = buildExtractionPrompt({
      fields: FIELDS, text: "текст", instruction: "ИНСТРУКЦИЯ", userNote: "закупка по проекту 1905",
    });
    expect(p).toContain("Контекст пользователя");
    expect(p).toContain("закупка по проекту 1905");
    // The note must be separable from the template's own rules.
    expect(p.indexOf("Контекст пользователя")).toBeGreaterThan(p.indexOf("ИНСТРУКЦИЯ"));
  });

  it("adds no section when there is no note", () => {
    const p = buildExtractionPrompt({ fields: FIELDS, text: "текст" });
    expect(p).not.toContain("Контекст пользователя");
  });

  it("adds no section for a blank note", () => {
    const p = buildExtractionPrompt({ fields: FIELDS, text: "текст", userNote: "   " });
    expect(p).not.toContain("Контекст пользователя");
  });

  it("marks a note-sourced field on its own line", () => {
    const fields: ExtractField[] = [{ ...base, id: "e3", label_ru: "Класс расхода", fromNote: true }];
    const p = buildExtractionPrompt({ fields, text: "текст" });
    expect(p).toContain("- e3: Класс расхода (string) — из контекста пользователя");
  });

  it("keeps a note-sourced field's own hint alongside the marker", () => {
    const fields: ExtractField[] = [
      { ...base, id: "e3", label_ru: "Класс расхода", fromNote: true, hint_ru: "например: ПРОЕКТЫ/1905/Мебель" },
    ];
    const p = buildExtractionPrompt({ fields, text: "текст" });
    expect(p).toContain("из контекста пользователя");
    expect(p).toContain("например: ПРОЕКТЫ/1905/Мебель");
  });
});

describe("the PT prompt does not drift", () => {
  it("still matches the text recorded in baseline.md", () => {
    const recorded = readFileSync("runs/2026-09-15-ed-passport-html/06-pt-prompt-before.txt", "utf8");
    const now = buildExtractionPrompt({
      fields: PT_FIELDS,
      text: "ОБРАЗЕЦ ТЕКСТА ДОКУМЕНТА",
      instruction: PT_INSTRUCTION,
      jsonFormatLine: "JSONLINE",
      localGuidance: true,
    });
    expect(now).toBe(recorded);
  });
});
