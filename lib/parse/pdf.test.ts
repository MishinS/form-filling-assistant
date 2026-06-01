import { describe, it, expect } from "vitest";
import { parsePdf } from "./pdf";
import { makeTextPdf, makeScannedPdf } from "./__fixtures__/make";

describe("parsePdf", () => {
  it("extracts per-page text with page locators", async () => {
    const res = await parsePdf(await makeTextPdf());
    expect(res.pages).toBe(2);
    expect(res.scannedPages).toEqual([]);
    expect(res.blocks[0].text).toContain("Contractor Romashka");
    expect(res.blocks[0].locator).toEqual({ kind: "pdf", page: 1 });
    expect(res.blocks[1].locator).toEqual({ kind: "pdf", page: 2 });
  });

  it("flags pages with no text layer as scanned", async () => {
    const res = await parsePdf(await makeScannedPdf());
    expect(res.pages).toBe(1);
    expect(res.blocks).toEqual([]);
    expect(res.scannedPages).toEqual([1]);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});
