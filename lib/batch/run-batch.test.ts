import { describe, it, expect, vi } from "vitest";
import { runBatch, type RunOne } from "./run-batch";

const file = (name: string) => new File(["x"], name);

describe("runBatch", () => {
  it("runs files in order and returns done items with bytes", async () => {
    const order: string[] = [];
    const runOne: RunOne = async (f) => { order.push(f.name); return new Uint8Array([1]); };
    const items = await runBatch([file("a"), file("b"), file("c")], runOne, () => {});
    expect(order).toEqual(["a", "b", "c"]);
    expect(items.map((i) => i.status)).toEqual(["done", "done", "done"]);
    expect(items[0].bytes).toEqual(new Uint8Array([1]));
  });

  it("marks a failing file as error and continues the rest", async () => {
    const runOne: RunOne = async (f) => {
      if (f.name === "b") throw new Error("boom");
      return new Uint8Array([1]);
    };
    const items = await runBatch([file("a"), file("b"), file("c")], runOne, () => {});
    expect(items.map((i) => i.status)).toEqual(["done", "error", "done"]);
    expect(items[1].error).toBe("boom");
    expect(items[1].bytes).toBeUndefined();
  });

  it("emits progress on every status transition", async () => {
    const runOne: RunOne = async () => new Uint8Array([1]);
    const onProgress = vi.fn();
    await runBatch([file("a"), file("b")], runOne, onProgress);
    // 2 files × (running + done) = 4 emissions
    expect(onProgress).toHaveBeenCalledTimes(4);
    const last = onProgress.mock.calls.at(-1)![0];
    expect(last.every((i: { status: string }) => i.status === "done")).toBe(true);
  });
});
