import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeLlmChat = vi.hoisted(() => vi.fn());
vi.mock("@/lib/desktop/tauri", () => ({ invokeLlmChat }));

import { localCompatModel } from "./local-model";
import { LlmRequestError } from "./openai-compat";
import type { ExtractField } from "../fields";

const FIELDS: ExtractField[] = [
  { id: "f1", group: "g", labelRu: "Контрагент", labelEn: "Counterparty", kind: "string", cell: "A1",
    required: false, source: "llm", strategy: "llm", fillMode: "value" } as unknown as ExtractField,
];

describe("localCompatModel", () => {
  beforeEach(() => invokeLlmChat.mockReset());

  it("builds a prompt, calls llm_chat, parses fields, emits start+win", async () => {
    invokeLlmChat.mockResolvedValueOnce('{"fields":[{"fieldId":"f1","value":"ACME","confidence":"high"}]}');
    const events: string[] = [];
    const model = localCompatModel("http://127.0.0.1:11434/v1", "llama3.1:8b");
    const out = await model.extract(FIELDS, "ACME Corp invoice", (e) => events.push(e.phase));
    expect(invokeLlmChat).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.1:8b" }),
    );
    expect(out).toEqual([{ fieldId: "f1", value: "ACME", confidence: "high" }]);
    expect(events).toEqual(["start", "win"]);
  });

  it("maps a transport rejection to a typed LlmRequestError", async () => {
    invokeLlmChat.mockRejectedValueOnce(new Error("auth"));
    const model = localCompatModel("x", "m");
    await expect(model.extract(FIELDS, "t")).rejects.toMatchObject({
      constructor: LlmRequestError, code: "auth",
    });
  });

  it("maps invalid JSON to bad_response", async () => {
    invokeLlmChat.mockResolvedValueOnce("not json");
    const model = localCompatModel("x", "m");
    await expect(model.extract(FIELDS, "t")).rejects.toMatchObject({ code: "bad_response" });
  });
});

describe("the local path carries the template's rules and the run note", () => {
  beforeEach(() => invokeLlmChat.mockReset());

  it("sends the instruction and the user note to the local runtime", async () => {
    invokeLlmChat.mockResolvedValueOnce('{"fields":[{"fieldId":"f1","value":"ACME","confidence":"high"}]}');
    const model = localCompatModel("http://127.0.0.1:11434/v1", "llama3.1:8b");
    await model.extract(FIELDS, "ACME Corp invoice", undefined, {
      instruction: "ИНСТРУКЦИЯ ШАБЛОНА",
      userNote: "закупка по проекту 1905",
    });
    const { prompt } = invokeLlmChat.mock.calls[0][0] as { prompt: string };
    expect(prompt.startsWith("ИНСТРУКЦИЯ ШАБЛОНА")).toBe(true);
    expect(prompt).toContain("Контекст пользователя");
    expect(prompt).toContain("закупка по проекту 1905");
    // The local path keeps its own guidance block alongside the template's rules.
    expect(prompt).toContain("верни КАЖДОЕ поле");
  });

  it("sends neither section when the template carries none", async () => {
    invokeLlmChat.mockResolvedValueOnce('{"fields":[{"fieldId":"f1","value":"ACME","confidence":"high"}]}');
    const model = localCompatModel("http://127.0.0.1:11434/v1", "llama3.1:8b");
    await model.extract(FIELDS, "ACME Corp invoice");
    const { prompt } = invokeLlmChat.mock.calls[0][0] as { prompt: string };
    expect(prompt).not.toContain("Контекст пользователя");
    expect(prompt).not.toContain("Платёжного требования");
  });
});
