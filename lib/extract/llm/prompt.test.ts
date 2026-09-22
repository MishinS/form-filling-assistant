import { describe,it,expect } from "vitest";
import { buildExtractionPrompt } from "./prompt";
import type { ExtractField } from "../fields";
import { PT_FIELDS,PT_INSTRUCTION } from "../fields";
import { ED_INSTRUCTION,ED_FIELDS } from "@/lib/render/ed";

const base: ExtractField = {
  id: "f1", group: "req", label_ru: "Контрагент", label_en: "Counterparty",
  cell: "ПТ!D9", kind: "string", required: true, strategy: "llm",
};

const FIELDS: ExtractField[] = [{ ...base, id: "f1", label_ru: "Контрагент", kind: "text" }];

describe("the template owns its instruction", () => {
  it("opens with the template's instruction", () => {
    const p = buildExtractionPrompt({ fields: FIELDS, text: "текст", instruction: "ИНСТРУКЦИЯ ШАБЛОНА" });
    expect(p.startsWith("ИНСТРУКЦИЯ ШАБЛОНА")).toBe(true);
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

  it("marks a note-sourced field on its own line", () => {
    const fields: ExtractField[] = [{ ...base, id: "e3", label_ru: "Класс расхода", fromNote: true }];
    const p = buildExtractionPrompt({ fields, text: "текст" });
    expect(p).toContain("- e3: Класс расхода (string) — из контекста пользователя");
  });
});
