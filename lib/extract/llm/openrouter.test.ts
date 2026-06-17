import { describe, it, expect, vi, afterEach } from "vitest";
import { openrouterModel } from "./openrouter";
import { ModelNotConfigured } from "./types";
import type { AttemptEvent } from "./types";
import { PT_FIELDS } from "../fields";
import { FREE_MODEL_IDS, PAID_LAST_RESORT } from "./catalog";

const MODEL = "moonshotai/kimi-k2.6:free"; // free slug НЕ из каталога → попадает в волну первым
const PAID = PAID_LAST_RESORT.id;
const okFields = (fields: unknown[]) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ fields }) } }] }));
const hangingFetch = (_url: unknown, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("openrouterModel (parallel race)", () => {
  it("throws ModelNotConfigured without an API key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(openrouterModel(MODEL).extract(PT_FIELDS, "текст"))
      .rejects.toBeInstanceOf(ModelNotConfigured);
  });

  it("returns the winning model's parsed fields", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const payload = [{ fieldId: "f1", value: "ООО «Ромашка»", confidence: "high" }];
    global.fetch = vi.fn(async () => okFields(payload)) as unknown as typeof fetch;
    const out = await openrouterModel(MODEL).extract(PT_FIELDS, "текст");
    expect(out).toEqual(payload);
  });

  it("a healthy model wins immediately even while another hangs (no need to wait the timeout)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    let call = 0;
    global.fetch = vi.fn((url: unknown, init?: RequestInit) => {
      call += 1;
      if (call === 1) return hangingFetch(url, init);
      return Promise.resolve(okFields([]));
    }) as unknown as typeof fetch;
    await expect(openrouterModel(MODEL).extract(PT_FIELDS, "текст")).resolves.toEqual([]);
  });

  it("emits a start for every free racer, then a win", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    global.fetch = vi.fn(async () => okFields([])) as unknown as typeof fetch;
    const events: AttemptEvent[] = [];
    await openrouterModel(MODEL).extract(PT_FIELDS, "текст", (e) => events.push(e));
    const starts = events.filter((e) => e.phase === "start");
    expect(starts.length).toBe(new Set([MODEL, ...FREE_MODEL_IDS]).size);
    expect(events.some((e) => e.phase === "win")).toBe(true);
  });

  it("falls back to the paid last-resort after the whole free wave fails", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { model: string };
      if (body.model === PAID) return okFields([{ fieldId: "f1", value: "X", confidence: "high" }]);
      return new Response("rate limited", { status: 429 });
    }) as unknown as typeof fetch;
    const events: AttemptEvent[] = [];
    const out = await openrouterModel(MODEL).extract(PT_FIELDS, "текст", (e) => events.push(e));
    expect(out).toEqual([{ fieldId: "f1", value: "X", confidence: "high" }]);
    const starts = events.filter((e) => e.phase === "start");
    expect(starts[starts.length - 1].model).toBe(PAID);
  });

  it("throws after both the free wave and the paid tail fail", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    global.fetch = vi.fn(async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    await expect(openrouterModel(MODEL).extract(PT_FIELDS, "текст")).rejects.toThrow("429");
  });

  it("when the whole free wave hangs, aborts it at the free timeout and the paid tail still runs", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    global.fetch = vi.fn((url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { model: string };
      if (body.model === PAID) return Promise.resolve(okFields([{ fieldId: "f1", value: "PAID", confidence: "high" }]));
      return hangingFetch(url, init);
    }) as unknown as typeof fetch;
    const events: AttemptEvent[] = [];
    const p = openrouterModel(MODEL).extract(PT_FIELDS, "текст", (e) => events.push(e));
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(p).resolves.toEqual([{ fieldId: "f1", value: "PAID", confidence: "high" }]);
    const starts = events.filter((e) => e.phase === "start");
    expect(starts[starts.length - 1].model).toBe(PAID);
  });

  it("runs the paid model alone when it is the selected primary (one fetch on success)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    global.fetch = vi.fn(async () => okFields([])) as unknown as typeof fetch;
    await openrouterModel(PAID).extract(PT_FIELDS, "текст");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("paid primary that fails falls back to the free wave, without re-racing paid", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { model: string };
      if (body.model === PAID) return new Response("err", { status: 429 });
      return okFields([]);
    }) as unknown as typeof fetch;
    const events: AttemptEvent[] = [];
    await openrouterModel(PAID).extract(PT_FIELDS, "текст", (e) => events.push(e));
    const paidStarts = events.filter((e) => e.phase === "start" && e.model === PAID);
    expect(paidStarts).toHaveLength(1);
  });

  it("engages the fallback wave when the primary is the openrouter/free auto-router", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { model: string };
      if (body.model === "openrouter/free") return new Response("rate limited", { status: 429 });
      return okFields([]);
    }) as unknown as typeof fetch;
    const events: AttemptEvent[] = [];
    const out = await openrouterModel("openrouter/free").extract(PT_FIELDS, "текст", (e) => events.push(e));
    expect(out).toEqual([]);
    expect(events.some((e) => e.phase === "fail" && e.model === "openrouter/free")).toBe(true);
    expect(events.some((e) => e.phase === "win" && e.model !== "openrouter/free")).toBe(true);
  });
});
