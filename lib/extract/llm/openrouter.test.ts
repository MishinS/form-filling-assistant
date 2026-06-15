import { describe, it, expect, vi, afterEach } from "vitest";
import { openrouterModel } from "./openrouter";
import { ModelNotConfigured } from "./types";
import type { AttemptEvent } from "./types";
import { PT_FIELDS } from "../fields";

const MODEL = "moonshotai/kimi-k2.6:free";
const PAID = "google/gemini-2.5-flash-lite";
const okFields = (fields: unknown[]) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ fields }) } }] }));

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

// A fetch mock that never settles until its abort signal fires (simulates a hung model).
const hangingFetch = (_url: unknown, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });

describe("openrouterModel", () => {
  it("throws ModelNotConfigured without an API key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(openrouterModel(MODEL).extract(PT_FIELDS, "текст"))
      .rejects.toBeInstanceOf(ModelNotConfigured);
  });

  it("parses the JSON message content into LlmFieldResult[]", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const payload = { fields: [{ fieldId: "f1", value: 'ООО «Ромашка»', confidence: "high" }] };
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }))) as unknown as typeof fetch;

    const out = await openrouterModel(MODEL).extract(PT_FIELDS, "текст");
    expect(out).toEqual(payload.fields);
  });

  it("throws on a non-OK HTTP response", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    global.fetch = vi.fn(async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    await expect(openrouterModel(MODEL).extract(PT_FIELDS, "текст")).rejects.toThrow("OpenRouter HTTP 429");
  });

  it("emits a start event for the primary model before fetching", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const payload = { fields: [{ fieldId: "f1", value: "X", confidence: "high" }] };
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }))) as unknown as typeof fetch;

    const events: AttemptEvent[] = [];
    await openrouterModel(MODEL).extract(PT_FIELDS, "текст", (ev) => events.push(ev));

    expect(events[0]).toMatchObject({ phase: "start", model: MODEL, index: 1 });
    expect(events[0].total).toBeGreaterThanOrEqual(1);
  });

  it("emits start then fail then start when the first model 429s and the next succeeds", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call === 1) return new Response("rate limited", { status: 429 });
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ fields: [] }) } }],
      }));
    }) as unknown as typeof fetch;

    const events: AttemptEvent[] = [];
    await openrouterModel(MODEL).extract(PT_FIELDS, "текст", (ev) => events.push(ev));

    expect(events[0]).toMatchObject({ phase: "start", model: MODEL });
    expect(events[1]).toMatchObject({ phase: "fail", model: MODEL });
    expect(events[1].reason).toContain("429");
    expect(events[2]).toMatchObject({ phase: "start" });
  });

  it("aborts a hung model after the per-attempt timeout and falls back to the next", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    let call = 0;
    global.fetch = vi.fn((url: unknown, init?: RequestInit) => {
      call += 1;
      if (call === 1) return hangingFetch(url, init);
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ fields: [] }) } }],
      })));
    }) as unknown as typeof fetch;

    const events: AttemptEvent[] = [];
    const p = openrouterModel(MODEL).extract(PT_FIELDS, "текст", (ev) => events.push(ev));
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(p).resolves.toEqual([]);
    expect(events[1]).toMatchObject({ phase: "fail", model: MODEL });
    expect(events[1].reason).toContain("Таймаут");
  });

  it("stops the chain at the overall deadline so the route can flush a terminal result", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    global.fetch = vi.fn(hangingFetch) as unknown as typeof fetch;

    const events: AttemptEvent[] = [];
    const p = openrouterModel(MODEL).extract(PT_FIELDS, "текст", (ev) => events.push(ev));
    const guarded = p.catch((e: Error) => e); // settle-once handle: no unhandled rejection while clocks advance
    await vi.advanceTimersByTimeAsync(50_000);
    const err = await guarded;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("Таймаут");
    // free phase (35s) burns primary(30s)+one free(5s); the RESERVED paid tail then
    // runs within the 50s chain deadline → 3 attempts, last is the paid last-resort.
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const starts = events.filter((e) => e.phase === "start");
    expect(starts).toHaveLength(3);
    expect(starts[2].model).toBe("google/gemini-2.5-flash-lite");
  });

  it("falls back to the paid last-resort after the free pool is exhausted", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { model: string };
      if (body.model === PAID) return okFields([{ fieldId: "f1", value: "X", confidence: "high" }]);
      return new Response("rate limited", { status: 429 });
    }) as unknown as typeof fetch;

    const events: AttemptEvent[] = [];
    const out = await openrouterModel(MODEL).extract(PT_FIELDS, "текст", (ev) => events.push(ev));
    expect(out).toEqual([{ fieldId: "f1", value: "X", confidence: "high" }]);
    const starts = events.filter((e) => e.phase === "start");
    expect(starts[starts.length - 1].model).toBe(PAID); // paid is the appended tail
  });

  it("runs the paid model first when it is the selected primary", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    global.fetch = vi.fn(async () => okFields([])) as unknown as typeof fetch;
    const events: AttemptEvent[] = [];
    await openrouterModel(PAID).extract(PT_FIELDS, "текст", (ev) => events.push(ev));
    expect(events[0]).toMatchObject({ phase: "start", model: PAID, index: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1); // succeeded first → no fallback needed
  });

  it("does not duplicate the paid model when it is primary (dedup)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call === 1) return new Response("err", { status: 429 }); // paid primary fails
      return okFields([]); // first free fallback succeeds
    }) as unknown as typeof fetch;
    const events: AttemptEvent[] = [];
    await openrouterModel(PAID).extract(PT_FIELDS, "текст", (ev) => events.push(ev));
    const paidStarts = events.filter((e) => e.phase === "start" && e.model === PAID);
    expect(paidStarts).toHaveLength(1); // appears once, NOT re-appended as a tail
  });

  it("engages the fallback chain when the primary is the openrouter/free auto-router", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call === 1) return new Response("rate limited", { status: 429 });
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ fields: [] }) } }],
      }));
    }) as unknown as typeof fetch;

    const events: AttemptEvent[] = [];
    await openrouterModel("openrouter/free").extract(PT_FIELDS, "текст", (ev) => events.push(ev));

    // primary = сам роутер, после его 429 цепочка ДОЛЖНА продолжиться каталожной моделью
    expect(events[0]).toMatchObject({ phase: "start", model: "openrouter/free", index: 1 });
    expect(events[1]).toMatchObject({ phase: "fail", model: "openrouter/free" });
    expect(events[2]).toMatchObject({ phase: "start" });
    expect(events[2].model).not.toBe("openrouter/free");
  });
});
