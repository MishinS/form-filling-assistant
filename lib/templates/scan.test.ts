import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { proposeFields } from "./scan";
import type { AttemptEvent } from "@/lib/extract/llm/types";

const SHEETS = [{ name: "Лист1", lines: ["A1: Поставщик", "B1: ___"] }];
const PROPOSAL = JSON.stringify({
  fields: [
    { label_ru: "Поставщик", label_en: "Supplier", cell: "Лист1!B1", kind: "string" },
    { label_ru: "Мусор", label_en: "Junk", cell: "Чужой!A1", kind: "string" }, // dropped: unknown sheet
  ],
});
const okResponse = (content: string) =>
  ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) }) as Response;

describe("proposeFields", () => {
  beforeEach(() => { vi.stubEnv("OPENROUTER_API_KEY", "test-key"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("maps a valid proposal (llm strategy, sequential ids), failure null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(PROPOSAL)));
    const { fields, failure } = await proposeFields(SHEETS);
    expect(failure).toBeNull();
    expect(fields).toEqual([
      { id: "f1", group: "req", label_ru: "Поставщик", label_en: "Supplier", cell: "Лист1!B1", kind: "string", required: false, strategy: "llm" },
    ]);
  });

  it("lenient: sheet-less cell → first sheet, `label` key fallback, unknown kind → string", async () => {
    const proposal = JSON.stringify({ fields: [{ label: "Сумма", cell: "B2", kind: "money" }] });
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(proposal)));
    const { fields, failure } = await proposeFields(SHEETS);
    expect(failure).toBeNull();
    expect(fields).toEqual([
      { id: "f1", group: "req", label_ru: "Сумма", label_en: "Сумма", cell: "Лист1!B2", kind: "string", required: false, strategy: "llm" },
    ]);
  });

  it("tolerates a ```json fence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse("```json\n" + PROPOSAL + "\n```")));
    const { fields } = await proposeFields(SHEETS);
    expect(fields).toHaveLength(1);
  });

  it("failure 'llm' without an API key (no fetch made)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "llm" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("failure 'llm' when every model is rejected (HTTP errors)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429 }) as Response));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "llm" });
  });

  it("failure 'nofields' when a model answers but nothing valid survives", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse("not json at all")));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "nofields" });
  });

  it("emits onAttempt start/fail along the chain", async () => {
    const events: AttemptEvent[] = [];
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValue(okResponse(PROPOSAL)));
    const { fields } = await proposeFields(SHEETS, (ev) => events.push(ev));
    expect(fields).toHaveLength(1);
    expect(events[0]).toMatchObject({ phase: "start", model: expect.any(String), index: 1, total: 5 });
    expect(events[1]).toMatchObject({ phase: "fail", reason: "HTTP 429" });
    expect(events[2]).toMatchObject({ phase: "start", index: 2 });
  });
});
