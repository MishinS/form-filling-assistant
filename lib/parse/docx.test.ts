import { describe, it, expect } from "vitest";
import { parseDocx } from "./docx";
import { makeDocx } from "./__fixtures__/make";

describe("parseDocx", () => {
  it("returns one block per non-empty paragraph with block-index locators", async () => {
    const res = await parseDocx(await makeDocx());
    expect(res.scannedPages).toEqual([]);
    expect(res.blocks.map(b => b.text)).toEqual(["Contract terms", "Net 30 days"]);
    expect(res.blocks[0].locator).toEqual({ kind: "docx", block: 0 });
    expect(res.blocks[1].locator).toEqual({ kind: "docx", block: 1 });
    expect(res.pages).toBe(2);
  });
});
