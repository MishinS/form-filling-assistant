import { describe, it, expect, vi, afterEach } from "vitest";
import { openrouterModel } from "./openrouter";
import { ModelNotConfigured } from "./types";
import type { AttemptEvent } from "./types";
import { PT_FIELDS } from "../fields";

const MODEL = "moonshotai/kimi-k2.6:free";

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
    // attempt 1 burns 30s, attempt 2 is capped to the 20s left; nothing may start past 50s
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(events.filter((e) => e.phase === "start")).toHaveLength(2);
  });
});
