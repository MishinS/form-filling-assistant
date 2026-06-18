import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedDoc } from "@/lib/parse/types";

const mockGetModel = vi.fn();
vi.mock("./llm/registry", () => ({ getModel: (id: string) => mockGetModel(id) }));
import { ModelNotConfigured } from "./llm/types";
import { extractFields } from "./extract";
import type { ExtractField } from "./fields";

const doc: ParsedDoc = {
  fileId: "u1", name: "Счёт №8.pdf", mime: "application/pdf", pages: 1, scannedPages: [], warnings: [],
  blocks: [
    { text: "Счёт №8 от 02.06.2026", locator: { kind: "pdf", page: 1 } },
    { text: "Итого к оплате: 12 000,00 руб.", locator: { kind: "pdf", page: 1 } },
  ],
};

beforeEach(() => { mockGetModel.mockReset(); });

describe("extractFields", () => {
  it("fills rule fields from regex with source attribution", async () => {
    mockGetModel.mockReturnValue({ id: "m", extract: async () => [] });
    const { values } = await extractFields([doc], "gemini-2.0-flash");
    const f3 = values.find(v => v.fieldId === "f3")!;
    expect(f3.value).toBe("Счёт №8 от 02.06.2026");
    expect(f3.confidence).toBe("high");
    expect(f3.source).toEqual({ fileId: "u1", locator: "стр. 1" });
    // f4: normalizeAmount converts "12 000,00" (space) → toLocaleString("ru-RU") → NBSP separator
    expect(values.find(v => v.fieldId === "f4")!.value).toBe("12 000,00");
  });

  it("fills llm fields from the model result", async () => {
    mockGetModel.mockReturnValue({
      id: "m",
      extract: async () => [{ fieldId: "f1", value: 'ООО «Тест»', confidence: "med" }],
    });
    const { values } = await extractFields([doc], "gemini-2.0-flash");
    expect(values.find(v => v.fieldId === "f1")!.value).toBe('ООО «Тест»');
  });

  it("degrades gracefully when the model is not configured", async () => {
    mockGetModel.mockImplementation(() => { throw new ModelNotConfigured("gemini-2.0-flash"); });
    const { values, warnings } = await extractFields([doc], "gemini-2.0-flash");
    expect(warnings.length).toBe(1);
    expect(values.find(v => v.fieldId === "f3")!.value).toBe("Счёт №8 от 02.06.2026");
    expect(values.find(v => v.fieldId === "f1")!.value).toBe("");
    expect(values.find(v => v.fieldId === "f1")!.confidence).toBe("low");
  });

  it("blanks the counterparty and warns when the model returns our own company", async () => {
    mockGetModel.mockReturnValue({
      id: "m",
      extract: async () => [{ fieldId: "f1", value: "АО Семейный доктор", confidence: "high" }],
    });
    const { values, warnings } = await extractFields([doc], "gemini-2.0-flash");
    const f1 = values.find(v => v.fieldId === "f1")!;
    expect(f1.value).toBe("");
    expect(f1.confidence).toBe("low");
    expect(warnings.some(w => w.includes("Контрагент не распознан"))).toBe(true);
  });

  it("keeps a genuine counterparty value", async () => {
    mockGetModel.mockReturnValue({
      id: "m",
      extract: async () => [{ fieldId: "f1", value: 'ООО «Ромашка»', confidence: "high" }],
    });
    const { values, warnings } = await extractFields([doc], "gemini-2.0-flash");
    expect(values.find(v => v.fieldId === "f1")!.value).toBe('ООО «Ромашка»');
    expect(warnings.length).toBe(0);
  });

  it("returns all 12 fields in catalog order", async () => {
    mockGetModel.mockReturnValue({ id: "m", extract: async () => [] });
    const { values } = await extractFields([doc], "gemini-2.0-flash");
    expect(values.map(v => v.fieldId)).toEqual(
      ["f1","f2","f3","f4","f5","f6","f7","f8","f9","f10","f11","f12"]);
  });

  it("reports llmFailed=false and usedModel=the winning model on success", async () => {
    mockGetModel.mockReturnValue({
      id: "m",
      extract: async (_f: unknown, _t: unknown, onAttempt?: (e: { phase: string; model: string }) => void) => {
        onAttempt?.({ phase: "start", model: "model-a" });
        onAttempt?.({ phase: "win", model: "model-a" });   // победитель — model-a
        onAttempt?.({ phase: "start", model: "model-b" });  // последний start ≠ победитель
        return [{ fieldId: "f1", value: "ООО «Тест»", confidence: "med" }];
      },
    });
    const out = await extractFields([doc], "model-a");
    expect(out.llmFailed).toBe(false);
    expect(out.usedModel).toBe("model-a");
  });

  it("reports llmFailed=true and usedModel=null when the LLM pass throws", async () => {
    mockGetModel.mockReturnValue({
      id: "m",
      extract: async () => { throw new Error("OpenRouter HTTP 429 (x)"); },
    });
    const out = await extractFields([doc], "x/y:free");
    expect(out.llmFailed).toBe(true);
    expect(out.usedModel).toBeNull();
    expect(out.warnings.some(w => w.includes("429"))).toBe(true);
    expect(out.values.find(v => v.fieldId === "f3")!.value).toBe("Счёт №8 от 02.06.2026");
  });

  it("пропускает constant/date поля (не отдаёт их в LLM)", async () => {
    const fields: ExtractField[] = [
      { id: "f1", group: "req", label_ru: "Контрагент", label_en: "C", cell: "ПТ!D9", kind: "string", required: true, strategy: "llm", fillMode: "constant", constantValue: "АО Семейный доктор" },
      { id: "f8", group: "pay", label_ru: "Вид", label_en: "T", cell: "ПТ!H15", kind: "string", required: true, strategy: "llm" },
    ];
    let sentToLlm: ExtractField[] = [];
    mockGetModel.mockReturnValue({
      id: "m",
      extract: async (fs: ExtractField[]) => { sentToLlm = fs; return fs.map(f => ({ fieldId: f.id, value: "X", confidence: "high" as const })); },
    });
    const res = await extractFields([doc], "any-model", fields);
    expect(sentToLlm.map(f => f.id)).toEqual(["f8"]);              // f1 (constant) НЕ ушёл в LLM
    expect(res.values.find(v => v.fieldId === "f1")?.value).toBe(""); // пуст (override при заливке)
  });

  it("keeps llmFailed=false when the model returns our own company (benign warning)", async () => {
    mockGetModel.mockReturnValue({
      id: "m",
      extract: async () => [{ fieldId: "f1", value: "АО «Семейный доктор»", confidence: "high" }],
    });
    const out = await extractFields([doc], "model-a");
    expect(out.llmFailed).toBe(false);
    expect(out.warnings.some(w => w.includes("Контрагент не распознан"))).toBe(true);
  });
});
