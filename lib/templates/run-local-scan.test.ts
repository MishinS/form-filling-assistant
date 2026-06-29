import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeLlmChat = vi.hoisted(() => vi.fn());
const getCachedRuntime = vi.hoisted(() =>
  vi.fn(() => ({ baseUrl: "http://127.0.0.1:1234/v1", kind: "lmstudio", models: [] as string[] }) as { baseUrl: string; kind: string; models: string[] } | null),
);

vi.mock("@/lib/desktop/tauri", () => ({ invokeLlmChat, getCachedRuntime }));

import { runLocalScan } from "./run-local-scan";

const SHEETS = [{ name: "Лист1", lines: ["A1: Поставщик", "B1:"] }];

describe("runLocalScan", () => {
  beforeEach(() => { invokeLlmChat.mockReset(); getCachedRuntime.mockReturnValue({ baseUrl: "http://127.0.0.1:1234/v1", kind: "lmstudio", models: [] }); });

  it("returns coerced fields and emits attempt + win on success", async () => {
    invokeLlmChat.mockResolvedValueOnce(
      '{"fields":[{"label_ru":"Поставщик","label_en":"Supplier","cell":"B1","kind":"string"}]}',
    );
    const lines: unknown[] = [];
    const out = await runLocalScan(SHEETS, "local:gemma-3-4b", (l) => lines.push(JSON.parse(l)));
    expect(out).toEqual({ fields: [{
      id: "f1", group: "req", label_ru: "Поставщик", label_en: "Supplier",
      cell: "Лист1!B1", kind: "string", required: false, strategy: "llm",
    }] });
    expect(lines).toEqual([
      { type: "attempt", model: "gemma-3-4b", total: 1 },
      { type: "attempt-win", model: "gemma-3-4b" },
    ]);
  });

  it("junk (non-JSON) → error llm + attempt-fail", async () => {
    invokeLlmChat.mockResolvedValueOnce("sorry I cannot");
    const lines: { type: string }[] = [];
    const out = await runLocalScan(SHEETS, "local:m", (l) => lines.push(JSON.parse(l)));
    expect(out).toEqual({ error: "llm" });
    expect(lines.at(-1)).toMatchObject({ type: "attempt-fail" });
  });

  it("understood-but-empty → error nofields", async () => {
    invokeLlmChat.mockResolvedValueOnce('{"fields":[]}');
    const out = await runLocalScan(SHEETS, "local:m", () => {});
    expect(out).toEqual({ error: "nofields" });
  });

  it("transport throw → error llm", async () => {
    invokeLlmChat.mockRejectedValueOnce(new Error("unreachable"));
    const out = await runLocalScan(SHEETS, "local:m", () => {});
    expect(out).toEqual({ error: "llm" });
  });

  it("no cached runtime → error llm, no LLM call", async () => {
    getCachedRuntime.mockReturnValueOnce(null);
    const out = await runLocalScan(SHEETS, "local:m", () => {});
    expect(out).toEqual({ error: "llm" });
    expect(invokeLlmChat).not.toHaveBeenCalled();
  });
});
