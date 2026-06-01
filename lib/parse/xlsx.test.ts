import { describe, it, expect } from "vitest";
import { parseXlsx } from "./xlsx";
import { makeXlsx } from "./__fixtures__/make";

describe("parseXlsx", () => {
  it("returns one block per filled cell with sheet+cell locators", async () => {
    const res = await parseXlsx(await makeXlsx());
    expect(res.pages).toBe(1);
    expect(res.scannedPages).toEqual([]);
    expect(res.blocks).toHaveLength(2);
    const a1 = res.blocks.find(b => b.locator.kind === "xlsx" && b.locator.cell === "A1");
    expect(a1?.text).toBe("Contractor");
    expect(a1?.locator).toMatchObject({ kind: "xlsx", sheet: "Sheet1", cell: "A1" });
    const b1 = res.blocks.find(b => b.locator.kind === "xlsx" && b.locator.cell === "B1");
    expect(b1?.text).toBe("Romashka");
  });
});
