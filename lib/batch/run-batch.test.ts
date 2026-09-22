import { describe,it,expect } from "vitest";
import { runBatch,type RunOne } from "./run-batch";

const file = (name: string) => new File(["x"], name);

describe("runBatch", () => {

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
});
