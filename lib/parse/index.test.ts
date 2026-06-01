import { describe, it, expect } from "vitest";
import { parseDocument } from "./index";
import { MIME } from "./types";
import { makeXlsx } from "./__fixtures__/make";

describe("parseDocument", () => {
  it("dispatches by mime and attaches document identity", async () => {
    const doc = await parseDocument(await makeXlsx(), MIME.xlsx, { fileId: "f1", name: "book.xlsx" });
    expect(doc.fileId).toBe("f1");
    expect(doc.name).toBe("book.xlsx");
    expect(doc.mime).toBe(MIME.xlsx);
    expect(doc.blocks.length).toBeGreaterThan(0);
  });

  it("returns a warning (no throw) for an unsupported mime", async () => {
    const doc = await parseDocument(Buffer.from("x"), "text/plain", { fileId: "f2", name: "a.txt" });
    expect(doc.blocks).toEqual([]);
    expect(doc.warnings[0]).toContain("Неподдерживаемый тип");
  });
});
