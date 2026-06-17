import { describe, it, expect, vi, afterEach } from "vitest";
import { raceModels, type Racer } from "./race";
import type { AttemptEvent } from "./types";

afterEach(() => { vi.useRealTimers(); });

const ev: () => { list: AttemptEvent[]; on: (e: AttemptEvent) => void } = () => {
  const list: AttemptEvent[] = [];
  return { list, on: (e) => list.push(e) };
};

describe("raceModels", () => {
  it("returns the first winner and aborts the other racers", async () => {
    let abortedB = false;
    const racers: Racer<string>[] = [
      { model: "a", run: async () => ({ win: true, value: "A" }) },
      { model: "b", run: (signal) => new Promise<never>(() => { signal.addEventListener("abort", () => { abortedB = true; }); }) },
    ];
    const out = await raceModels(racers, { timeoutMs: 1000 });
    expect(out).toEqual({ ok: true, model: "a", value: "A" });
    expect(abortedB).toBe(true);
  });

  it("returns {ok:false, failures} when every racer loses, preserving reasons", async () => {
    const racers: Racer<string>[] = [
      { model: "a", run: async () => ({ win: false, reason: "429" }) },
      { model: "b", run: async () => ({ win: false, reason: "bad json" }) },
    ];
    const out = await raceModels(racers, { timeoutMs: 1000 });
    expect(out).toEqual({ ok: false, failures: [
      { model: "a", reason: "429", understood: undefined },
      { model: "b", reason: "bad json", understood: undefined },
    ] });
  });

  it("carries the understood flag through failures", async () => {
    const racers: Racer<string>[] = [
      { model: "a", run: async () => ({ win: false, reason: "no fields", understood: true }) },
    ];
    const out = await raceModels(racers, { timeoutMs: 1000 });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failures[0].understood).toBe(true);
  });

  it("aborts a hung racer at timeoutMs and reports a Таймаут failure", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const racers: Racer<string>[] = [
      { model: "hung", run: (signal) => new Promise<{ win: false; reason: string }>((_res, rej) => {
        signal.addEventListener("abort", () => rej(new DOMException("Aborted", "AbortError")));
      }) },
    ];
    const p = raceModels(racers, { timeoutMs: 5000 });
    await vi.advanceTimersByTimeAsync(5000);
    const out = await p;
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failures[0].reason).toContain("Таймаут");
  });

  it("emits start for every racer, then a single win", async () => {
    const { list, on } = ev();
    const racers: Racer<string>[] = [
      { model: "a", run: async () => ({ win: false, reason: "x" }) },
      { model: "b", run: async () => ({ win: true, value: "B" }) },
    ];
    await raceModels(racers, { timeoutMs: 1000, onAttempt: on });
    const starts = list.filter((e) => e.phase === "start").map((e) => e.model);
    expect(starts).toEqual(["a", "b"]);
    expect(list.some((e) => e.phase === "win" && e.model === "b")).toBe(true);
    expect(list.every((e) => e.total === 2 || e.phase !== "start")).toBe(true);
  });

  it("handles an empty racer list", async () => {
    expect(await raceModels([], { timeoutMs: 1000 })).toEqual({ ok: false, failures: [] });
  });
});
