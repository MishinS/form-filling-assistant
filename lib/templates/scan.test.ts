import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { proposeFields } from "./scan";
import type { AttemptEvent } from "@/lib/extract/llm/types";
import { FREE_MODEL_IDS, PAID_LAST_RESORT } from "@/lib/extract/llm/catalog";

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

  it("failure 'llm' (not 'nofields') when models answer with unparseable junk", async () => {
    // Junk content (weak router-routed model) must NOT masquerade as «не распознала поля» —
    // the honest verdict is pool failure → «модели заняты», retry makes sense.
    vi.stubGlobal("fetch", vi.fn(async () => okResponse("not json at all")));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "llm" });
  });

  it("failure 'llm' when the answer is JSON but without a fields[] array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse('{"data":"что-то не то"}')));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "llm" });
  });

  it("failure 'nofields' when a model understood the schema but no field survives", async () => {
    // Valid {"fields":[…]} → the model did the task; every entry dropped (unknown sheet).
    const understood = JSON.stringify({ fields: [{ label_ru: "Мусор", cell: "Чужой!A1", kind: "string" }] });
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(understood)));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "nofields" });
  });

  it("emits onAttempt start/fail along the chain", async () => {
    const events: AttemptEvent[] = [];
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValue(okResponse(PROPOSAL)));
    const { fields } = await proposeFields(SHEETS, (ev) => events.push(ev));
    expect(fields).toHaveLength(1);
    expect(events[0]).toMatchObject({ phase: "start", model: expect.any(String), index: 1, total: FREE_MODEL_IDS.length + 1 });
    expect(events[1]).toMatchObject({ phase: "fail", reason: "HTTP 429" });
    expect(events[2]).toMatchObject({ phase: "start", index: 2 });
  });

  it("falls back to the paid last-resort after the free pool fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { model: string };
      if (body.model === PAID_LAST_RESORT.id) return okResponse(PROPOSAL);
      return { ok: false, status: 429 } as Response;
    }));
    const events: AttemptEvent[] = [];
    const { fields, failure } = await proposeFields(SHEETS, (ev) => events.push(ev));
    expect(failure).toBeNull();
    expect(fields).toHaveLength(1);
    const starts = events.filter((e) => e.phase === "start");
    expect(starts[starts.length - 1].model).toBe(PAID_LAST_RESORT.id);
  });

  it("aborts a hung model after the per-attempt timeout and falls back to the next", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    let call = 0;
    vi.stubGlobal("fetch", vi.fn((_url: unknown, init?: RequestInit) => {
      call += 1;
      if (call === 1) return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
      return Promise.resolve(okResponse(PROPOSAL));
    }));
    const events: AttemptEvent[] = [];
    const p = proposeFields(SHEETS, (ev) => events.push(ev));
    // Scan answers are small/fast (healthy ≤2s local, ≤10s on Vercel) — the scan chain
    // aborts a hung attempt at 20s so even two hangs fit the 50s chain deadline.
    await vi.advanceTimersByTimeAsync(20_000);
    const { fields, failure } = await p;
    vi.useRealTimers();
    expect(failure).toBeNull();
    expect(fields).toHaveLength(1);
    expect(events[1]).toMatchObject({ phase: "fail" });
    expect(events[1].reason).toContain("Таймаут");
  });
});
