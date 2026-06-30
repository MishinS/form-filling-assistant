import { describe, it, expect, vi, beforeEach } from "vitest";

const extractFields = vi.hoisted(() => vi.fn());
const getCachedRuntime = vi.hoisted(() => vi.fn(() => ({ baseUrl: "http://127.0.0.1:11434/v1", kind: "ollama", models: [] })));

vi.mock("@/lib/extract/extract", () => ({ extractFields }));
vi.mock("@/lib/desktop/tauri", () => ({
  getCachedRuntime,
}));
vi.mock("./local-model", () => ({ localCompatModel: vi.fn(() => ({ id: "m" })) }));

import { runLocalExtract } from "./run-local-extract";

describe("runLocalExtract", () => {
  beforeEach(() => extractFields.mockReset());

  it("emits attempt + result lines mirroring the /api/extract stream", async () => {
    extractFields.mockImplementationOnce(async (_docs, _id, _fields, onAttempt) => {
      onAttempt({ phase: "start", model: "llama3.1:8b", total: 1 });
      onAttempt({ phase: "win", model: "llama3.1:8b" });
      return { values: [{ fieldId: "f1", value: "ACME" }], warnings: [], llmFailed: false, usedModel: "llama3.1:8b" };
    });
    const lines: unknown[] = [];
    await runLocalExtract([], "local:llama3.1:8b", [], (l) => lines.push(JSON.parse(l)));
    expect(lines).toEqual([
      { type: "local-eta", ms: 15000 },
      { type: "attempt", model: "llama3.1:8b", total: 1 },
      { type: "attempt-win", model: "llama3.1:8b" },
      { type: "result", values: [{ fieldId: "f1", value: "ACME" }], warnings: [], llmFailed: false, usedModel: "llama3.1:8b" },
    ]);
  });

  it("emits a failed result when no runtime is cached", async () => {
    const { getCachedRuntime } = await import("@/lib/desktop/tauri");
    vi.mocked(getCachedRuntime).mockReturnValueOnce(null);
    const lines: { type: string; llmFailed?: boolean }[] = [];
    await runLocalExtract([], "local:m", [], (l) => lines.push(JSON.parse(l)));
    expect(lines.at(-1)).toMatchObject({ type: "result", llmFailed: true });
    expect(extractFields).not.toHaveBeenCalled();
  });
});
